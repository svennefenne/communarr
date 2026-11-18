import "server-only";
import { db, now, tx } from "./db";
import { UserError } from "./errors";
import { BggError, bggCollection, bggMode } from "./bgg";
import type { ShelfAccount, ShelfGame } from "./types";

/**
 * A member's game shelf: the board games they own on BoardGameGeek, shown on their profile. They give
 * their name on BGG (Settings → Profile); the site fetches their collection then, and again once a day
 * on the minute clock (instrumentation.ts), one member at a time. BGG often answers a collection's
 * first request with "queued, ask again in a moment", so the clock asks again a little later.
 * Needs the site's BGG token (bggMode "full").
 */

const MIN = 60_000;
const DAY = 86_400_000;
/** "Fetch now" no more often than this */
const AGAIN_AFTER = 10 * MIN;
/** how many times to ask again while BGG keeps the collection queued, before calling it an error */
const QUEUED_TRIES = 12;

interface AccountRow {
  user_id: number;
  username: string;
  status: ShelfAccount["status"];
  games: number;
  fetched_at: number | null;
  next_at: number;
  tries: number;
}

const toAccount = (r: AccountRow): ShelfAccount => ({ username: r.username, status: r.status, games: r.games, fetchedAt: r.fetched_at });

function row(userId: number): AccountRow | undefined {
  return db().prepare("select * from bgg_accounts where user_id = ?").get(userId) as AccountRow | undefined;
}

/** Their link to BGG, if they've made one. */
export function shelfAccount(userId: number): ShelfAccount | null {
  const r = row(userId);
  return r ? toAccount(r) : null;
}

interface ShelfRow {
  game_id: number;
  name: string;
  year: number | null;
  thumb: string | null;
  min_players: number | null;
  max_players: number | null;
  min_time: number | null;
  max_time: number | null;
  rating: number | null;
  rank: number | null;
  mine: number | null;
  plays: number;
  added_at: number | null;
}

const toGame = (r: ShelfRow): ShelfGame => ({
  id: r.game_id,
  name: r.name,
  year: r.year,
  thumb: r.thumb,
  players: r.min_players ? [r.min_players, r.max_players ?? r.min_players] : null,
  time: r.min_time ? [r.min_time, r.max_time ?? r.min_time] : null,
  rating: r.rating ? Math.round(r.rating * 10) / 10 : null,
  rank: r.rank,
  mine: r.mine,
  plays: r.plays,
  added: r.added_at,
});

/** The games on their shelf, by name; or with `latest`, that many of the newest. */
export function shelfGames(userId: number, latest?: number): ShelfGame[] {
  const rows = (
    latest
      ? db().prepare("select * from bgg_shelf where user_id = ? order by added_at desc, name collate nocase limit ?").all(userId, latest)
      : db().prepare("select * from bgg_shelf where user_id = ? order by name collate nocase").all(userId)
  ) as ShelfRow[];
  return rows.map(toGame);
}

/** How many games a group's members own between them (each game once). */
export function groupShelfCount(groupId: number): number {
  return (db().prepare("select count(distinct s.game_id) n from bgg_shelf s join group_members m on m.user_id = s.user_id where m.group_id = ?").get(groupId) as { n: number }).n;
}

/**
 * The group's game shelf: every game its members own, once, and who owns it (in the order they joined).
 * Their own ratings stay theirs (none here); plays are added up, and "newest" is the latest any of them got it.
 */
export function groupShelf(groupId: number): { games: ShelfGame[]; owners: Record<number, number[]> } {
  const rows = db()
    .prepare("select s.* from bgg_shelf s join group_members m on m.user_id = s.user_id where m.group_id = ? order by m.joined_at, s.user_id")
    .all(groupId) as (ShelfRow & { user_id: number })[];
  const games = new Map<number, ShelfGame>();
  const owners: Record<number, number[]> = {};
  for (const r of rows) {
    const had = games.get(r.game_id);
    if (!had) games.set(r.game_id, { ...toGame(r), mine: null });
    else {
      had.plays += r.plays;
      had.added = Math.max(had.added ?? 0, r.added_at ?? 0) || null;
    }
    (owners[r.game_id] ??= []).push(r.user_id);
  }
  return { games: [...games.values()].sort((a, b) => a.name.localeCompare(b.name)), owners };
}

/** A name on BGG: letters, digits, spaces, _ . - (as BGG allows), at most 50. */
function cleanName(raw: string): string {
  const name = raw.trim().replace(/^@/, "").replace(/\s+/g, " ");
  if (!name) return "";
  if (name.length > 50 || !/^[\p{L}\p{N} _.-]+$/u.test(name)) throw new UserError("That isn't a name on BoardGameGeek.");
  return name;
}

/**
 * Link (or change, or with an empty name remove) their name on BGG, and fetch their games straight
 * away (once: if BGG queues it, the clock asks again).
 */
export async function setShelfName(userId: number, raw: string): Promise<ShelfAccount | null> {
  const name = cleanName(raw);
  if (!name) {
    removeShelf(userId);
    return null;
  }
  if (bggMode() !== "full") throw new UserError("Game shelves are off on this site.");
  const had = row(userId);
  if (had && had.username.toLowerCase() === name.toLowerCase() && had.status !== "unknown") {
    // the same name: only how it's written, if that changed
    db().prepare("update bgg_accounts set username = ? where user_id = ?").run(name, userId);
    return shelfAccount(userId);
  }
  tx(() => {
    db().prepare("delete from bgg_shelf where user_id = ?").run(userId);
    db()
      .prepare(
        `insert into bgg_accounts (user_id, username, status, games, fetched_at, next_at, tries) values (?, ?, 'pending', 0, null, ?, 0)
         on conflict(user_id) do update set username = excluded.username, status = 'pending', games = 0, fetched_at = null, next_at = excluded.next_at, tries = 0`,
      )
      .run(userId, name, now());
  });
  await fetchSoon(userId);
  return shelfAccount(userId);
}

/** "Fetch now": their games again (not more often than every ten minutes). */
export async function refreshShelf(userId: number): Promise<ShelfAccount | null> {
  const r = row(userId);
  if (!r) return null;
  if (bggMode() !== "full") throw new UserError("Game shelves are off on this site.");
  if (r.fetched_at && r.fetched_at > now() - AGAIN_AFTER) throw new UserError("Your games were fetched a moment ago. Try again in a few minutes.");
  db().prepare("update bgg_accounts set next_at = ?, tries = 0 where user_id = ?").run(now(), userId);
  await fetchSoon(userId);
  return shelfAccount(userId);
}

export function removeShelf(userId: number) {
  tx(() => {
    db().prepare("delete from bgg_shelf where user_id = ?").run(userId);
    db().prepare("delete from bgg_accounts where user_id = ?").run(userId);
  });
}

// (kept across hot reloads) the shelves being fetched right now, and whether the clock is fetching one
const g = globalThis as typeof globalThis & { __bggShelfBusy?: boolean; __bggShelfNow?: Set<number> };
const fetching: Set<number> = (g.__bggShelfNow ??= new Set());

/** While they wait (linking, "Fetch now"): BGG usually has a queued collection ready within seconds, so ask a few times. */
async function fetchSoon(userId: number) {
  for (let i = 0; i < 3; i++) {
    if ((await fetchShelf(userId)) !== "queued") return;
    await new Promise((r) => setTimeout(r, 4_000));
  }
}

/** Ask BGG for their collection once, and keep what comes back (or when to ask again). */
async function fetchShelf(userId: number): Promise<"done" | "queued"> {
  if (fetching.has(userId)) return "done";
  fetching.add(userId);
  try {
    return await fetchOnce(userId);
  } finally {
    fetching.delete(userId);
  }
}

async function fetchOnce(userId: number): Promise<"done" | "queued"> {
  const r = row(userId);
  if (!r) return "done";
  const later = (ms: number, status: ShelfAccount["status"] = r.status, tries = r.tries) =>
    db().prepare("update bgg_accounts set status = ?, next_at = ?, tries = ? where user_id = ? and username = ?").run(status, now() + ms, tries, userId, r.username);
  let got: Awaited<ReturnType<typeof bggCollection>>;
  try {
    got = await bggCollection(r.username);
  } catch (e) {
    // busy: in a few minutes; the token or BGG itself: in an hour (the shelf they have stays)
    const busy = e instanceof BggError && e.kind === "busy";
    later(busy ? 5 * MIN : 60 * MIN, r.fetched_at ? r.status : busy ? r.status : "error");
    return "done";
  }
  // (BGG is putting it together: again shortly, and if it never comes, tomorrow)
  if (got === "queued") {
    const tries = r.tries + 1;
    if (tries >= QUEUED_TRIES) later(DAY, r.fetched_at ? r.status : "error", 0);
    else later(tries < 4 ? 20_000 : 2 * MIN, r.status, tries);
    return "queued";
  }
  if (got === "unknown") {
    tx(() => {
      db().prepare("delete from bgg_shelf where user_id = ?").run(userId);
      db().prepare("update bgg_accounts set status = 'unknown', games = 0, fetched_at = ?, next_at = ?, tries = 0 where user_id = ? and username = ?").run(now(), now() + 7 * DAY, userId, r.username);
    });
    return "done";
  }
  const games = got;
  tx(() => {
    // (their name changed while BGG was answering: that answer is for the old one)
    if (row(userId)?.username !== r.username) return;
    db().prepare("delete from bgg_shelf where user_id = ?").run(userId);
    const add = db().prepare(
      `insert into bgg_shelf (user_id, game_id, name, year, thumb, min_players, max_players, min_time, max_time, rating, rank, mine, plays, added_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const g of games) add.run(userId, g.id, g.name, g.year, g.thumb, g.players?.[0] ?? null, g.players?.[1] ?? null, g.time?.[0] ?? null, g.time?.[1] ?? null, g.rating, g.rank, g.mine, g.plays, g.added);
    db().prepare("update bgg_accounts set status = 'ok', games = ?, fetched_at = ?, next_at = ?, tries = 0 where user_id = ?").run(games.length, now(), now() + DAY, userId);
  });
  return "done";
}

/** On the minute clock: the one shelf most overdue for a fetch, if any (one at a time, never two at once). */
export function shelfTick() {
  if (g.__bggShelfBusy || bggMode() !== "full") return;
  const due = db().prepare("select user_id from bgg_accounts where next_at <= ? order by next_at limit 1").get(now()) as { user_id: number } | undefined;
  if (!due) return;
  g.__bggShelfBusy = true;
  fetchShelf(due.user_id)
    .catch((e) => console.error("[bgg shelf]", e))
    .finally(() => (g.__bggShelfBusy = false));
}
