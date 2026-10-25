import "server-only";
import { db, now, tx } from "./db";
import type { Reaction } from "./types";

export type ReactTarget = "post" | "comment" | "message" | "thread" | "reply" | "poll" | "event";

/** Reactions for many things at once: id → reactions (most used first). */
export function reactionsFor(type: ReactTarget, ids: number[], me: number): Map<number, Reaction[]> {
  const out = new Map<number, Reaction[]>();
  if (!ids.length) return out;
  const rows = db()
    .prepare(
      `select r.target_id id, r.emoji, count(*) n, max(r.user_id = ?) mine, group_concat(u.display_name, '|') names, min(r.created_at) first
       from reactions r join users u on u.id = r.user_id
       where r.target_type = ? and r.target_id in (${ids.map(() => "?").join(",")})
       group by r.target_id, r.emoji order by first`,
    )
    .all(me, type, ...ids) as { id: number; emoji: string; n: number; mine: number; names: string }[];
  for (const r of rows) {
    if (!out.has(r.id)) out.set(r.id, []);
    out.get(r.id)!.push({ emoji: r.emoji, count: r.n, mine: !!r.mine, users: r.names.split("|").slice(0, 12) });
  }
  return out;
}

/**
 * React to something: one reaction per person and thing. The one you have takes it back; another
 * one takes its place. Returns the thing's reactions afterwards.
 */
export function toggleReaction(userId: number, type: ReactTarget, id: number, emoji: string): { added: boolean; reactions: Reaction[] } {
  const e = [...emoji].slice(0, 8).join("");
  if (!e.trim()) return { added: false, reactions: reactionsFor(type, [id], userId).get(id) ?? [] };
  const exists = db().prepare("select 1 from reactions where target_type = ? and target_id = ? and user_id = ? and emoji = ?").get(type, id, userId, e);
  tx(() => {
    db().prepare("delete from reactions where target_type = ? and target_id = ? and user_id = ?").run(type, id, userId);
    if (!exists) db().prepare("insert into reactions (target_type, target_id, user_id, emoji, created_at) values (?, ?, ?, ?, ?)").run(type, id, userId, e, now());
  });
  return { added: !exists, reactions: reactionsFor(type, [id], userId).get(id) ?? [] };
}

/** A thing's reactions with who gave them (for live updates: each browser works out its own "mine"). */
export function reactionsRaw(type: ReactTarget, id: number): { emoji: string; count: number; users: string[]; ids: number[] }[] {
  const rows = db()
    .prepare(
      `select r.emoji, group_concat(u.display_name, '|') names, group_concat(u.id, '|') ids, min(r.created_at) first
       from reactions r join users u on u.id = r.user_id where r.target_type = ? and r.target_id = ? group by r.emoji order by first`,
    )
    .all(type, id) as { emoji: string; names: string; ids: string }[];
  return rows.map((r) => {
    const ids = r.ids.split("|").map(Number);
    return { emoji: r.emoji, count: ids.length, users: r.names.split("|").slice(0, 12), ids };
  });
}

export function clearReactions(type: ReactTarget, id: number) {
  db().prepare("delete from reactions where target_type = ? and target_id = ?").run(type, id);
}
