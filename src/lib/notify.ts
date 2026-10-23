import "server-only";
import { db, now } from "./db";
import { isLooking, sendTo } from "./hub";
import { pushTo } from "./push";
import { getSettings } from "./settings";
import { summaries, toUser, type UserRow } from "./users";
import type { NotificationItem, NotifyKind, NotifyPrefs } from "./types";

export interface NotifyInput {
  kind: NotifyKind;
  actorId?: number | null;
  title: string;
  body?: string;
  url: string;
  /** chat messages: no bell entry (the chat has its own unread counts), only a push */
  pushOnly?: boolean;
  /** collapse pushes with the same tag on the device (a chat room) */
  tag?: string;
}

function inQuietHours(p: NotifyPrefs): boolean {
  if (!p.quietFrom || !p.quietTo) return false;
  const tz = (p as NotifyPrefs & { tz?: string }).tz || getSettings().timezone;
  let hm: string;
  try {
    hm = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(new Date());
  } catch {
    return false;
  }
  const { quietFrom: a, quietTo: b } = p;
  return a <= b ? hm >= a && hm < b : hm >= a || hm < b;
}

/**
 * Tell people about something: an entry in their bell (live), and a push notification on their
 * devices unless they're looking at the site right now. Each member's settings decide which kinds
 * they get, and quiet hours hold pushes back. The one who did it is never notified.
 */
export function notify(userIds: Iterable<number>, n: NotifyInput) {
  const ids = [...new Set(userIds)].filter((id) => id && id !== n.actorId);
  if (!ids.length) return;
  const rows = db()
    .prepare(`select * from users where id in (${ids.map(() => "?").join(",")}) and banned = 0`)
    .all(...ids) as UserRow[];
  const actor = n.actorId ? summaries([n.actorId]).get(n.actorId) ?? null : null;
  const t = now();
  const ins = db().prepare("insert into notifications (user_id, kind, actor_id, title, body, url, created_at) values (?, ?, ?, ?, ?, ?, ?)");
  for (const r of rows) {
    const u = toUser(r);
    const pref = u.notify[n.kind] ?? { app: true, push: true };
    let unread = 0;
    if (!n.pushOnly && pref.app) {
      const id = Number(ins.run(u.id, n.kind, n.actorId ?? null, n.title, n.body ?? "", n.url, t).lastInsertRowid);
      unread = (db().prepare("select count(*) c from notifications where user_id = ? and read_at is null").get(u.id) as { c: number }).c;
      const item: NotificationItem = { id, kind: n.kind, title: n.title, body: n.body ?? "", url: n.url, read: false, createdAt: t, actor };
      sendTo(u.id, "notify", { item, unread });
    }
    if (pref.push && !isLooking(u.id) && !inQuietHours(u.notify)) {
      void pushTo(u.id, { title: n.title, body: n.body ?? "", url: n.url, tag: n.tag ?? n.kind, badge: unread || undefined }).catch(() => {});
    }
  }
}

export function listNotifications(userId: number, opts: { before?: number; limit?: number; unread?: boolean } = {}): NotificationItem[] {
  const rows = db()
    .prepare(
      `select * from notifications where user_id = ? ${opts.before ? "and id < ?" : ""} ${opts.unread ? "and read_at is null" : ""} order by id desc limit ?`,
    )
    .all(...[userId, ...(opts.before ? [opts.before] : []), opts.limit ?? 40]) as {
    id: number;
    kind: string;
    actor_id: number | null;
    title: string;
    body: string;
    url: string;
    read_at: number | null;
    created_at: number;
  }[];
  const actors = summaries(rows.map((r) => r.actor_id!).filter(Boolean));
  return rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, url: r.url, read: !!r.read_at, createdAt: r.created_at, actor: r.actor_id ? actors.get(r.actor_id) ?? null : null }));
}

export function markRead(userId: number, ids: number[] | "all") {
  if (ids === "all") db().prepare("update notifications set read_at = ? where user_id = ? and read_at is null").run(now(), userId);
  else if (ids.length) db().prepare(`update notifications set read_at = ? where user_id = ? and id in (${ids.map(() => "?").join(",")})`).run(now(), userId, ...ids);
  const unread = (db().prepare("select count(*) c from notifications where user_id = ? and read_at is null").get(userId) as { c: number }).c;
  sendTo(userId, "notifyCount", { unread });
  return unread;
}

/** Mark notifications pointing at a page read (opening the page counts as reading them). */
export function markReadByUrl(userId: number, url: string) {
  const r = db().prepare("update notifications set read_at = ? where user_id = ? and read_at is null and (url = ? or url like ?)").run(now(), userId, url, url + "#%");
  if (r.changes) {
    const unread = (db().prepare("select count(*) c from notifications where user_id = ? and read_at is null").get(userId) as { c: number }).c;
    sendTo(userId, "notifyCount", { unread });
  }
}
