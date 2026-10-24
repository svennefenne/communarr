import "server-only";
import { db } from "./db";
import { UserError } from "./errors";
import { cleanHtml, cleanLine } from "./sanitize";
import { hashPassword, verifyPassword } from "./auth";
import { indexItem } from "./search";
import { broadcast, dropUser } from "./hub";
import { USERNAME_RE, type User, type UserRow } from "./users";
import { NOTIFY_KINDS, type NotifyKind, type NotifyPrefs } from "./types";

const media = (s: unknown) => (typeof s === "string" && /^\/media\/[\w./-]+$/.test(s) ? s : null);

export interface ProfileInput {
  name?: string;
  pronouns?: string;
  bioHtml?: string;
  location?: string;
  website?: string;
  birthday?: string | null;
  accent?: string | null;
  avatar?: string | null;
  banner?: string | null;
}

export function updateProfile(u: User, o: ProfileInput) {
  const name = o.name !== undefined ? cleanLine(o.name, 40) : u.name;
  if (!name) throw new UserError("Your name can't be empty.");
  const bio = o.bioHtml !== undefined ? cleanHtml(o.bioHtml, { maxLength: 20_000 }).html : u.bioHtml;
  let website = o.website !== undefined ? cleanLine(o.website, 200) : u.website;
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
  const birthday = o.birthday === undefined ? u.birthday : o.birthday && /^\d{2}-\d{2}$/.test(o.birthday) ? o.birthday : null;
  db()
    .prepare("update users set display_name = ?, pronouns = ?, bio_html = ?, location = ?, website = ?, birthday = ?, accent = ?, avatar = ?, banner = ? where id = ?")
    .run(
      name,
      o.pronouns !== undefined ? cleanLine(o.pronouns, 30) : u.pronouns,
      bio,
      o.location !== undefined ? cleanLine(o.location, 80) : u.location,
      website,
      birthday,
      o.accent !== undefined ? (o.accent && /^#[0-9a-f]{6}$/i.test(o.accent) ? o.accent : null) : u.accent,
      o.avatar !== undefined ? media(o.avatar) : u.avatar,
      o.banner !== undefined ? media(o.banner) : u.banner,
      u.id,
    );
  indexItem("user", u.id, "members", u.id, u.createdAt, name, `${u.username} ${o.location ?? u.location}`);
  broadcast("profile", { id: u.id });
}

export async function changePassword(u: User, current: string, next: string, keepSession: string | null) {
  const row = db().prepare("select password_hash from users where id = ?").get(u.id) as { password_hash: string };
  if (!(await verifyPassword(current, row.password_hash))) throw new UserError("Your current password isn't right.");
  if (next.length < 8) throw new UserError("Passwords need at least 8 characters.");
  db().prepare("update users set password_hash = ? where id = ?").run(await hashPassword(next), u.id);
  // everywhere else is logged out, and open streams closed (this tab reconnects on its own)
  if (keepSession) db().prepare("delete from sessions where user_id = ? and id != ?").run(u.id, keepSession);
  dropUser(u.id);
}

export function changeUsername(u: User, username: string) {
  if (!USERNAME_RE.test(username)) throw new UserError("Usernames are 2–24 letters, numbers, dots, dashes or underscores.");
  const taken = db().prepare("select id from users where username = ?").get(username) as { id: number } | undefined;
  if (taken && taken.id !== u.id) throw new UserError("That username is taken.");
  db().prepare("update users set username = ? where id = ?").run(username, u.id);
  indexItem("user", u.id, "members", u.id, u.createdAt, u.name, username);
}

export function sessionsOf(userId: number) {
  return db().prepare("select id, created_at createdAt, last_used lastUsed, user_agent ua, ip from sessions where user_id = ? order by last_used desc").all(userId) as {
    id: string;
    createdAt: number;
    lastUsed: number;
    ua: string;
    ip: string;
  }[];
}

export function endSessionById(userId: number, id: string) {
  db().prepare("delete from sessions where user_id = ? and id = ?").run(userId, id);
}

export function setNotifyPrefs(u: User, input: Partial<Record<NotifyKind, { app?: boolean; push?: boolean; mail?: boolean }>> & { quietFrom?: string; quietTo?: string; tz?: string }) {
  const next = { ...u.notify } as NotifyPrefs & { tz?: string };
  for (const k of Object.keys(NOTIFY_KINDS) as NotifyKind[]) {
    const v = input[k];
    if (v) next[k] = { app: v.app ?? next[k].app, push: v.push ?? next[k].push, mail: v.mail ?? next[k].mail };
  }
  const hm = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (input.quietFrom !== undefined) next.quietFrom = hm.test(input.quietFrom) ? input.quietFrom : "";
  if (input.quietTo !== undefined) next.quietTo = hm.test(input.quietTo) ? input.quietTo : "";
  if (input.tz) next.tz = input.tz.slice(0, 60);
  db().prepare("update users set notify_json = ? where id = ?").run(JSON.stringify(next), u.id);
  return next;
}

/** What someone has done, for their profile. */
export function stats(userId: number) {
  const n = (sql: string) => (db().prepare(sql).get(userId) as { n: number }).n;
  return {
    posts: n("select count(*) n from posts where author_id = ? and visibility = 'members'"),
    threads: n("select count(*) n from forum_threads where author_id = ?"),
    replies: n("select count(*) n from forum_posts where author_id = ?"),
    polls: n("select count(*) n from polls where author_id = ?"),
    events: n("select count(*) n from events where author_id = ?"),
    messages: n("select count(*) n from messages m join rooms r on r.id = m.room_id where m.author_id = ? and m.deleted = 0 and r.kind != 'dm'"),
  };
}

export function deleteOwnAccount(u: User) {
  if (u.isAdmin && (db().prepare("select count(*) n from users where role = 'admin'").get() as { n: number }).n <= 1) throw new UserError("You're the only admin: make someone else admin first.");
  db().prepare("delete from users where id = ?").run(u.id);
}

export function rawUser(id: number): UserRow | null {
  return (db().prepare("select * from users where id = ?").get(id) as UserRow | undefined) ?? null;
}
