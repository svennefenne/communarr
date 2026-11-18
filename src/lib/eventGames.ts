import "server-only";
import { db, now } from "./db";
import { UserError } from "./errors";
import { getEvent, upcoming } from "./events";
import { summaries, type User } from "./users";
import type { BroughtGame, BringOption, ShelfGame } from "./types";

/**
 * Games brought to an event (a game night): someone going (or maybe going) takes games off their game
 * shelf (bggShelf.ts) along, and the event shows them, who brings each, whether it fits the number
 * coming, and how many of those coming want to play it (gameMarks.ts).
 */

/** a member's games to one event, at most */
const MAX = 20;

interface Row {
  user_id: number;
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
  plays: number;
  added_at: number | null;
}

const toGame = (r: Row): ShelfGame => ({
  id: r.game_id,
  name: r.name,
  year: r.year,
  thumb: r.thumb,
  players: r.min_players ? [r.min_players, r.max_players ?? r.min_players] : null,
  time: r.min_time ? [r.min_time, r.max_time ?? r.min_time] : null,
  rating: r.rating ? Math.round(r.rating * 10) / 10 : null,
  rank: r.rank,
  mine: null,
  plays: r.plays,
  added: r.added_at,
});

/** What's brought to an event (that the viewer can see), the most wanted first. */
export function broughtTo(u: User, eventId: number): BroughtGame[] {
  const e = getEvent(u, eventId);
  if (!e) return [];
  // (a game they've since taken off their shelf isn't on its way any more)
  const rows = db()
    .prepare("select s.* from event_games g join bgg_shelf s on s.user_id = g.user_id and s.game_id = g.game_id where g.event_id = ? order by g.created_at")
    .all(eventId) as Row[];
  if (!rows.length) return [];
  const coming = [...e.going, ...e.maybe].map((p) => p.id);
  const wants = new Map<number, number>();
  if (coming.length)
    for (const w of db()
      .prepare(`select game_id, count(*) n from game_marks where want = 1 and user_id in (${coming.map(() => "?").join(",")}) group by game_id`)
      .all(...coming) as { game_id: number; n: number }[])
      wants.set(w.game_id, w.n);
  const people = summaries(rows.map((r) => r.user_id));
  return rows
    .map((r) => ({ game: toGame(r), by: people.get(r.user_id)!, wants: wants.get(r.game_id) ?? 0, mine: r.user_id === u.id }))
    .filter((b) => b.by)
    .sort((a, b) => b.wants - a.wants || a.game.name.localeCompare(b.game.name));
}

/** Can games be brought to it still: not cancelled, not over (a repeating one: while it repeats). */
function open(u: User, eventId: number) {
  const e = getEvent(u, eventId);
  if (!e) throw new UserError("That event isn't there.");
  if (e.cancelled) throw new UserError("That event is cancelled.");
  if (e.repeat === "none" ? e.endAt < now() : e.repeatUntil !== null && e.repeatUntil < now()) throw new UserError("That event is over.");
  return e;
}

/** Bring a game off their shelf to an event they're going (or maybe going) to, or planned. */
export function bringGame(u: User, eventId: number, gameId: number) {
  const e = open(u, eventId);
  if (e.author.id !== u.id && e.mine !== "going" && e.mine !== "maybe") throw new UserError("Say you're coming first, then you can bring games.");
  if (!db().prepare("select 1 from bgg_shelf where user_id = ? and game_id = ?").get(u.id, gameId)) throw new UserError("That game isn't on your shelf.");
  const n = (db().prepare("select count(*) n from event_games where event_id = ? and user_id = ?").get(eventId, u.id) as { n: number }).n;
  if (n >= MAX) throw new UserError("That's {n} games already: leave some at home.", { n: MAX });
  db().prepare("insert or ignore into event_games (event_id, user_id, game_id, created_at) values (?, ?, ?, ?)").run(eventId, u.id, gameId, now());
}

export function leaveGame(u: User, eventId: number, gameId: number) {
  db().prepare("delete from event_games where event_id = ? and user_id = ? and game_id = ?").run(eventId, u.id, gameId);
}

/** For a game's box: the coming events they could bring it to (going, maybe going, or theirs), and whether it's already on its way there. */
export function bringOptions(u: User, gameId: number): BringOption[] {
  const seen = new Set<number>();
  const bringing = new Set((db().prepare("select event_id from event_games where user_id = ? and game_id = ?").all(u.id, gameId) as { event_id: number }[]).map((r) => r.event_id));
  const out: BringOption[] = [];
  for (const e of upcoming(u, 40)) {
    if (seen.has(e.id) || (e.author.id !== u.id && e.mine !== "going" && e.mine !== "maybe")) continue;
    seen.add(e.id);
    out.push({ id: e.id, title: e.title, startAt: e.startAt, allDay: e.allDay, bringing: bringing.has(e.id) });
  }
  return out.slice(0, 12);
}
