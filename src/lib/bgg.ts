import "server-only";
import { Parser } from "htmlparser2";
import { db, now } from "./db";
import { getMeta, getSettings, setMeta } from "./settings";
import type { BggGame, BggMode } from "./types";

/**
 * BoardGameGeek, for bgg: in the editor: games found by name, and a game's details for its card.
 * BGG's XML API needs a token (an application registered at boardgamegeek.com/applications), set in
 * Admin → Features & permissions. Without one, bgg: links to a search on BGG instead. The site asks
 * BGG one thing at a time and keeps what it learns (searches a day, games two weeks), as BGG asks.
 */

const DAY = 86_400_000;
const GAME_FOR = 14 * DAY;
const SEARCH_FOR = DAY;

// (a stand-in BGG for trying it out; never in production)
const api = () => (process.env.NODE_ENV !== "production" && process.env.BGG_API_BASE) || "https://boardgamegeek.com/xmlapi2";

export function bggToken(): string {
  return getMeta("bgg.token") || process.env.BGG_TOKEN || "";
}
export function setBggToken(token: string) {
  setMeta("bgg.token", token);
}

/** off: switched off; search: no token, so bgg: links to BGG's search; full: games suggested and shown */
export function bggMode(): BggMode {
  if (!getSettings().bggLinks) return "off";
  return bggToken() ? "full" : "search";
}

/** what went wrong asking BGG: the token isn't accepted, it's busy (try later), or it didn't answer */
export class BggError extends Error {
  constructor(readonly kind: "token" | "busy" | "down") {
    super(`BoardGameGeek: ${kind}`);
  }
}

// (kept across hot reloads and Next's separately bundled routes)
const g = globalThis as typeof globalThis & { __bggQueue?: Promise<unknown>; __bggRate?: Map<number, number[]> };

// one request at a time, a little apart
const GAP = 400;
function ask(path: string, token = bggToken()): Promise<string> {
  const run = (g.__bggQueue ?? Promise.resolve()).then(async () => {
    let res: Response;
    try {
      res = await fetch(`${api()}${path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/xml", "User-Agent": "Mozilla/5.0 (compatible; CommunarrBot/1.0; +https://github.com/svennefenne/communarr)" },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new BggError("down");
    }
    if (res.status === 401 || res.status === 403) throw new BggError("token");
    // (202: BGG has queued it; 429: too many)
    if (res.status === 202 || res.status === 429) throw new BggError("busy");
    if (!res.ok) throw new BggError("down");
    return res.text();
  });
  g.__bggQueue = run.catch(() => {}).then(() => new Promise((r) => setTimeout(r, GAP)));
  return run;
}

interface El {
  name: string;
  attrs: Record<string, string>;
  text: string;
  kids: El[];
}

function xml(src: string): El {
  const root: El = { name: "", attrs: {}, text: "", kids: [] };
  const stack = [root];
  const p = new Parser(
    {
      onopentag(name, attrs) {
        const el: El = { name, attrs, text: "", kids: [] };
        stack[stack.length - 1].kids.push(el);
        stack.push(el);
      },
      ontext(text) {
        stack[stack.length - 1].text += text;
      },
      onclosetag() {
        if (stack.length > 1) stack.pop();
      },
    },
    { xmlMode: true, decodeEntities: true },
  );
  p.write(src);
  p.end();
  return root;
}
const kids = (el: El | undefined, name: string) => el?.kids.filter((k) => k.name === name) ?? [];
const kid = (el: El | undefined, name: string) => el?.kids.find((k) => k.name === name);
const num = (s: string | undefined) => (s && Number.isFinite(Number(s)) ? Number(s) : null);
const value = (el: El | undefined, name: string) => num(kid(el, name)?.attrs.value);

/** how well a name fits what was typed: 0 the same, 1 starts with it, 2 a word starts with it, 3 has it */
function fit(query: string, name: string): number {
  const q = query.toLowerCase();
  const n = name.toLowerCase();
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.split(/[\s:–—-]+/).some((w) => w.startsWith(q))) return 2;
  return n.includes(q) ? 3 : 4;
}

interface GameRow {
  id: number;
  name: string;
  year: number | null;
  thumb: string | null;
  image: string | null;
  min_players: number | null;
  max_players: number | null;
  min_time: number | null;
  max_time: number | null;
  min_age: number | null;
  weight: number | null;
  rating: number | null;
  users_rated: number | null;
  rank: number | null;
  fetched_at: number;
}

const toGame = (r: GameRow): BggGame => ({
  id: r.id,
  name: r.name,
  year: r.year,
  thumb: r.thumb,
  image: r.image,
  players: r.min_players ? [r.min_players, r.max_players ?? r.min_players] : null,
  time: r.max_time || r.min_time ? [r.min_time ?? r.max_time!, r.max_time ?? r.min_time!] : null,
  age: r.min_age || null,
  weight: r.weight ? Math.round(r.weight * 100) / 100 : null,
  rating: r.rating ? Math.round(r.rating * 10) / 10 : null,
  usersRated: r.users_rated ?? 0,
  rank: r.rank,
});

/** Games by id: kept ones, the rest asked for (up to 20 at a time). */
async function games(ids: number[]): Promise<Map<number, BggGame>> {
  const out = new Map<number, BggGame>();
  if (!ids.length) return out;
  const rows = db()
    .prepare(`select * from bgg_games where id in (${ids.map(() => "?").join(",")}) and fetched_at > ?`)
    .all(...ids, now() - GAME_FOR) as GameRow[];
  for (const r of rows) out.set(r.id, toGame(r));
  const missing = ids.filter((id) => !out.has(id)).slice(0, 20);
  if (!missing.length) return out;
  const root = xml(await ask(`/thing?id=${missing.join(",")}&stats=1`));
  const up = db().prepare(
    `insert into bgg_games (id, name, year, thumb, image, min_players, max_players, min_time, max_time, min_age, weight, rating, users_rated, rank, fetched_at)
     values (@id, @name, @year, @thumb, @image, @min_players, @max_players, @min_time, @max_time, @min_age, @weight, @rating, @users_rated, @rank, @fetched_at)
     on conflict(id) do update set name = excluded.name, year = excluded.year, thumb = excluded.thumb, image = excluded.image, min_players = excluded.min_players,
       max_players = excluded.max_players, min_time = excluded.min_time, max_time = excluded.max_time, min_age = excluded.min_age, weight = excluded.weight,
       rating = excluded.rating, users_rated = excluded.users_rated, rank = excluded.rank, fetched_at = excluded.fetched_at`,
  );
  for (const it of kids(kid(root, "items"), "item")) {
    const id = num(it.attrs.id);
    const name = kids(it, "name").find((n) => n.attrs.type === "primary")?.attrs.value ?? kid(it, "name")?.attrs.value;
    if (!id || !name) continue;
    const ratings = kid(kid(it, "statistics"), "ratings");
    const rank = kids(kid(ratings, "ranks"), "rank").find((r) => r.attrs.name === "boardgame")?.attrs.value;
    const https = (s: string | undefined) => (s && /^https:\/\//.test(s.trim()) ? s.trim() : null);
    const r: GameRow = {
      id,
      name: name.slice(0, 200),
      year: value(it, "yearpublished") || null,
      thumb: https(kid(it, "thumbnail")?.text),
      image: https(kid(it, "image")?.text),
      min_players: value(it, "minplayers"),
      max_players: value(it, "maxplayers"),
      min_time: value(it, "minplaytime") ?? value(it, "playingtime"),
      max_time: value(it, "maxplaytime") ?? value(it, "playingtime"),
      min_age: value(it, "minage"),
      weight: value(ratings, "averageweight"),
      rating: value(ratings, "average"),
      users_rated: value(ratings, "usersrated"),
      rank: num(rank),
      fetched_at: now(),
    };
    up.run(r);
    out.set(id, toGame(r));
  }
  return out;
}

// searches that ask BGG, per member: plenty for typing, not a flood
const rate: Map<number, number[]> = (g.__bggRate ??= new Map());
function allowed(userId: number): boolean {
  const t = now();
  const mine = (rate.get(userId) ?? []).filter((x) => x > t - 10 * 60_000);
  if (mine.length >= 60) return false;
  rate.set(userId, [...mine, t]);
  return true;
}

/** Games whose name fits what was typed, the best fits first and then the most played. */
export async function searchGames(userId: number, raw: string): Promise<BggGame[]> {
  const q = raw.trim().replace(/\s+/g, " ").slice(0, 60);
  if (q.length < 2) return [];
  const key = q.toLowerCase();
  const kept = db().prepare("select ids from bgg_searches where query = ? and fetched_at > ?").get(key, now() - SEARCH_FOR) as { ids: string } | undefined;
  // [id, the name it was found by (an alternate one, maybe)]
  let found: [number, string][];
  if (kept) found = JSON.parse(kept.ids);
  else {
    if (!allowed(userId)) throw new BggError("busy");
    const root = xml(await ask(`/search?query=${encodeURIComponent(q)}&type=boardgame`));
    const all = kids(kid(root, "items"), "item")
      .map((it): [number, string] => [num(it.attrs.id) ?? 0, kid(it, "name")?.attrs.value ?? ""])
      .filter(([id, name]) => id && name);
    // the closest twenty (shorter names first: the base game before its expansions)
    found = [...new Map(all.map((x) => [x[0], x])).values()].sort((a, b) => fit(q, a[1]) - fit(q, b[1]) || a[1].length - b[1].length).slice(0, 20);
    db().prepare("insert into bgg_searches (query, ids, fetched_at) values (?, ?, ?) on conflict(query) do update set ids = excluded.ids, fetched_at = excluded.fetched_at").run(key, JSON.stringify(found), now());
  }
  let details = new Map<number, BggGame>();
  try {
    details = await games(found.map((f) => f[0]));
  } catch {
    /* names and years without the rest */
  }
  const by = new Map(found);
  return found
    .map(([id, name]) => details.get(id) ?? { id, name, year: null, thumb: null, image: null, players: null, time: null, age: null, weight: null, rating: null, usersRated: 0, rank: null })
    .sort((a, b) => fit(q, by.get(a.id) ?? a.name) - fit(q, by.get(b.id) ?? b.name) || b.usersRated - a.usersRated)
    .slice(0, 8);
}

/** One game's details (for its card). */
export async function bggGame(userId: number, id: number): Promise<BggGame | null> {
  const kept = db().prepare("select * from bgg_games where id = ? and fetched_at > ?").get(id, now() - GAME_FOR) as GameRow | undefined;
  if (kept) return toGame(kept);
  if (!allowed(userId)) throw new BggError("busy");
  return (await games([id])).get(id) ?? null;
}

/** Try a token before keeping it: a small search. */
export async function checkBggToken(token: string): Promise<void> {
  await ask("/search?query=catan&type=boardgame", token);
}
