import "server-only";
import { db, now } from "./db";
import { UserError } from "./errors";
import { summaries } from "./users";
import type { GameStats, GameTalk } from "./types";

/**
 * What members make of the board games on the game shelves (bggShelf.ts), by the game's number on
 * BoardGameGeek: their own rating (1–10) and whether they want to play it. A member who hasn't rated a
 * game they own here counts with the rating they gave it on BGG, so the shelves have ratings from the
 * start. "Us" is a group's members on its shelf, everyone elsewhere.
 */

/** Rate a game 1–10, or (null) take the rating away. */
export function rateGame(userId: number, gameId: number, rating: number | null) {
  if (!Number.isInteger(gameId) || gameId <= 0) throw new UserError("That game isn't there.");
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 10)) throw new UserError("A rating is a whole number from 1 to 10.");
  db()
    .prepare(
      `insert into game_marks (user_id, game_id, rating, want, updated_at) values (?, ?, ?, 0, ?)
       on conflict(user_id, game_id) do update set rating = excluded.rating, updated_at = excluded.updated_at`,
    )
    .run(userId, gameId, rating, now());
  tidy(userId, gameId);
}

/** Want to play a game (or not any more). */
export function wantGame(userId: number, gameId: number, on: boolean) {
  if (!Number.isInteger(gameId) || gameId <= 0) throw new UserError("That game isn't there.");
  db()
    .prepare(
      `insert into game_marks (user_id, game_id, rating, want, updated_at) values (?, ?, null, ?, ?)
       on conflict(user_id, game_id) do update set want = excluded.want, updated_at = excluded.updated_at`,
    )
    .run(userId, gameId, on ? 1 : 0, now());
  tidy(userId, gameId);
}

// (nothing left to keep: no row)
function tidy(userId: number, gameId: number) {
  db().prepare("delete from game_marks where user_id = ? and game_id = ? and rating is null and want = 0").run(userId, gameId);
}

/** Everyone's (or with `groupId`, the group's members') ratings: their own here, else the one they gave it on BGG (owners only). */
function ratingsFor(gameIds: number[] | null, groupId?: number): { game_id: number; user_id: number; rating: number; bgg: number }[] {
  const scope = groupId ? "join group_members gm on gm.user_id = x.user_id and gm.group_id = @group" : "";
  const games = gameIds ? `and x.game_id in (${gameIds.map((_, i) => `@g${i}`).join(",") || "null"})` : "";
  const params: Record<string, number> = { group: groupId ?? 0 };
  gameIds?.forEach((g, i) => (params[`g${i}`] = g));
  return db()
    .prepare(
      `select x.game_id, x.user_id, x.rating, 0 bgg from game_marks x ${scope} where x.rating is not null ${games}
       union all
       select x.game_id, x.user_id, round(x.mine) rating, 1 bgg from bgg_shelf x ${scope}
         where x.mine is not null ${games} and not exists (select 1 from game_marks m where m.user_id = x.user_id and m.game_id = x.game_id and m.rating is not null)`,
    )
    .all(params) as { game_id: number; user_id: number; rating: number; bgg: number }[];
}

/** Per game on a group's shelf: our average rating, how many rated it, and how many want to play it. */
export function groupGameStats(groupId: number): Record<number, GameStats> {
  const out: Record<number, GameStats> = {};
  const add = (id: number) => (out[id] ??= { avg: null, rated: 0, wants: 0 });
  const sums: Record<number, number> = {};
  for (const r of ratingsFor(null, groupId)) {
    const s = add(r.game_id);
    s.rated++;
    sums[r.game_id] = (sums[r.game_id] ?? 0) + r.rating;
  }
  for (const [id, sum] of Object.entries(sums)) out[Number(id)].avg = Math.round((sum / out[Number(id)].rated) * 10) / 10;
  const wants = db().prepare("select m.game_id, count(*) n from game_marks m join group_members gm on gm.user_id = m.user_id and gm.group_id = ? where m.want = 1 group by m.game_id").all(groupId) as { game_id: number; n: number }[];
  for (const w of wants) add(w.game_id).wants = w.n;
  return out;
}

/** A game, for its box on a shelf: who owns it, who rated it what, who wants to play it, and the viewer's own. */
export function gameTalk(viewerId: number, gameId: number, groupId?: number): GameTalk {
  const scope = groupId ? "join group_members gm on gm.user_id = x.user_id and gm.group_id = ?" : "";
  const args = groupId ? [groupId, gameId] : [gameId];
  const owners = (db().prepare(`select x.user_id from bgg_shelf x ${scope} where x.game_id = ? order by x.added_at`).all(...args) as { user_id: number }[]).map((r) => r.user_id);
  const ratings = ratingsFor([gameId], groupId);
  const wants = (db().prepare(`select x.user_id from game_marks x ${scope} where x.game_id = ? and x.want = 1 order by x.updated_at`).all(...args) as { user_id: number }[]).map((r) => r.user_id);
  const people = summaries([...owners, ...ratings.map((r) => r.user_id), ...wants]);
  const mine = db().prepare("select rating, want from game_marks where user_id = ? and game_id = ?").get(viewerId, gameId) as { rating: number | null; want: number } | undefined;
  const myBgg = db().prepare("select mine from bgg_shelf where user_id = ? and game_id = ?").get(viewerId, gameId) as { mine: number | null } | undefined;
  const sum = ratings.reduce((n, r) => n + r.rating, 0);
  return {
    owners: owners.map((id) => people.get(id)).filter((p) => !!p),
    ratings: ratings
      .map((r) => ({ user: people.get(r.user_id)!, rating: r.rating, fromBgg: !!r.bgg }))
      .filter((r) => r.user)
      .sort((a, b) => b.rating - a.rating),
    avg: ratings.length ? Math.round((sum / ratings.length) * 10) / 10 : null,
    wants: wants.map((id) => people.get(id)).filter((p) => !!p),
    mine: { rating: mine?.rating ?? null, bggRating: myBgg?.mine ? Math.round(myBgg.mine) : null, want: !!mine?.want },
  };
}
