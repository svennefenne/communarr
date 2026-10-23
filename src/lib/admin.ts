import "server-only";
import fs from "node:fs";
import path from "node:path";
import { db, DATA_DIR, now, tx, UPLOAD_DIR } from "./db";
import { UserError } from "./errors";
import { serverT } from "./t";
import { audit, hashPassword, randomToken } from "./auth";
import { dropUser, onlineCount, sendTo } from "./hub";
import { indexItem } from "./search";
import { groupScope } from "./groups";
import { openReportCount } from "./reports";
import { summary, type User, type UserRow } from "./users";
import type { Role, UserSummary } from "./types";

export interface AdminMember extends UserSummary {
  createdAt: number;
  lastSeen: number | null;
  banned: boolean;
  banReason: string | null;
  suspendedUntil: number | null;
  pending: boolean;
  posts: number;
  messages: number;
  invitedBy: string | null;
}

export function overview() {
  const n = (sql: string, ...p: unknown[]) => (db().prepare(sql).get(...p) as { n: number }).n;
  const week = now() - 7 * 86_400_000;
  const dbSize = ["hooden.db", "hooden.db-wal"].reduce((s, f) => s + (fs.existsSync(path.join(DATA_DIR, f)) ? fs.statSync(path.join(DATA_DIR, f)).size : 0), 0);
  const up = db().prepare("select coalesce(sum(size), 0) n from uploads").get() as { n: number };
  return {
    members: n("select count(*) n from users where banned = 0 and (ban_reason is null or ban_reason != 'pending')"),
    online: onlineCount(),
    pending: n("select count(*) n from users where ban_reason = 'pending' and banned = 0"),
    reports: openReportCount(),
    postsWeek: n("select count(*) n from posts where created_at > ?", week) + n("select count(*) n from forum_threads where created_at > ?", week) + n("select count(*) n from forum_posts where created_at > ?", week),
    messagesWeek: n("select count(*) n from messages where created_at > ? and kind = 'text'", week),
    upcoming: n("select count(*) n from events where start_at > ? and cancelled = 0", now()),
    openPolls: n("select count(*) n from polls where closed = 0"),
    groups: n("select count(*) n from groups"),
    rooms: n("select count(*) n from rooms where kind != 'dm'"),
    devices: n("select count(*) n from push_subs"),
    invites: n("select count(*) n from invites where revoked = 0 and (expires_at is null or expires_at > ?) and (max_uses is null or uses < max_uses)", now()),
    dbBytes: dbSize,
    uploadBytes: up.n,
  };
}

/** Activity per day for the last `days` days (local days of the server). */
export function activity(days = 30): { day: string; posts: number; forum: number; messages: number; comments: number }[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const from = start.getTime();
  const bucket = (sql: string) => {
    const m = new Map<number, number>();
    for (const r of db().prepare(sql).all(from) as { t: number }[]) {
      const d = new Date(r.t);
      d.setHours(0, 0, 0, 0);
      m.set(d.getTime(), (m.get(d.getTime()) ?? 0) + 1);
    }
    return m;
  };
  const posts = bucket("select created_at t from posts where created_at >= ?");
  const threads = bucket("select created_at t from forum_threads where created_at >= ?");
  const replies = bucket("select created_at t from forum_posts where created_at >= ?");
  const messages = bucket("select created_at t from messages where created_at >= ? and kind = 'text'");
  const comments = bucket("select created_at t from comments where created_at >= ?");
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const k = d.getTime();
    out.push({ day: d.toISOString().slice(0, 10), posts: posts.get(k) ?? 0, forum: (threads.get(k) ?? 0) + (replies.get(k) ?? 0), messages: messages.get(k) ?? 0, comments: comments.get(k) ?? 0 });
  }
  return out;
}

export function adminMembers(): AdminMember[] {
  const rows = db().prepare("select * from users order by created_at desc").all() as UserRow[];
  const count = (sql: string) => new Map((db().prepare(sql).all() as { id: number; n: number }[]).map((r) => [r.id, r.n]));
  const posts = count("select author_id id, count(*) n from posts group by author_id");
  const msgs = count("select author_id id, count(*) n from messages where author_id is not null group by author_id");
  const names = new Map(rows.map((r) => [r.id, r.display_name]));
  return rows.map((r) => ({
    ...summary(r),
    createdAt: r.created_at,
    lastSeen: r.last_seen,
    banned: !!r.banned,
    banReason: r.ban_reason,
    suspendedUntil: r.ban_reason === "pending" ? null : r.suspended_until,
    pending: r.ban_reason === "pending" && !r.banned,
    posts: posts.get(r.id) ?? 0,
    messages: msgs.get(r.id) ?? 0,
    invitedBy: r.invited_by ? names.get(r.invited_by) ?? null : null,
  }));
}

function target(id: number): UserRow {
  const r = db().prepare("select * from users where id = ?").get(id) as UserRow | undefined;
  if (!r) throw new UserError("No such member.");
  return r;
}

/** Logged out everywhere: sessions gone, and every open stream (live chat, voice) closed. */
function kick(userId: number) {
  db().prepare("delete from sessions where user_id = ?").run(userId);
  sendTo(userId, "refresh", {});
  dropUser(userId);
}

export function setRole(by: User, id: number, role: Role) {
  if (!by.isAdmin) throw new UserError("Only admins can change roles.");
  const t = target(id);
  if (t.id === by.id && role !== "admin") {
    const admins = (db().prepare("select count(*) n from users where role = 'admin'").get() as { n: number }).n;
    if (admins <= 1) throw new UserError("You're the only admin: make someone else admin first.");
  }
  db().prepare("update users set role = ? where id = ?").run(role, id);
  audit(by.id, "role", t.username, role);
  sendTo(id, "refresh", {});
}

export function suspend(by: User, id: number, days: number | null) {
  const t = target(id);
  if (t.role === "admin" && !by.isAdmin) throw new UserError("Moderators can't suspend admins.");
  if (t.id === by.id) throw new UserError("You can't suspend yourself.");
  const until = days ? now() + days * 86_400_000 : null;
  db().prepare("update users set suspended_until = ?, ban_reason = case when ban_reason = 'pending' then null else ban_reason end where id = ?").run(until, id);
  if (until) kick(id);
  audit(by.id, days ? "suspend" : "unsuspend", t.username, days ? `${days} days` : "");
}

export function ban(by: User, id: number, banned: boolean, reason = "") {
  if (!by.isAdmin) throw new UserError("Only admins can close accounts.");
  const t = target(id);
  if (t.id === by.id) throw new UserError("You can't close your own account here.");
  db().prepare("update users set banned = ?, ban_reason = ? where id = ?").run(banned ? 1 : 0, banned ? reason.slice(0, 200) || null : null, id);
  if (banned) kick(id);
  audit(by.id, banned ? "ban" : "unban", t.username, reason);
}

export function approve(by: User, id: number, yes: boolean) {
  const t = target(id);
  // only for sign-ups waiting to get in (not a way round a suspension)
  if (t.ban_reason !== "pending" || t.banned) throw new UserError("They aren't waiting to get in.");
  if (yes) db().prepare("update users set suspended_until = null, ban_reason = null where id = ?").run(id);
  else db().prepare("delete from users where id = ? and ban_reason = 'pending'").run(id);
  audit(by.id, yes ? "approve" : "reject", t.username);
}

export function resetLink(by: User, id: number): string {
  if (!by.isAdmin) throw new UserError("Only admins can make reset links.");
  const t = target(id);
  const token = randomToken(24);
  db().prepare("insert into resets (token, user_id, created_at, expires_at) values (?, ?, ?, ?)").run(token, id, now(), now() + 3 * 86_400_000);
  audit(by.id, "reset link", t.username);
  return token;
}

export function logoutEverywhere(by: User, id: number) {
  const t = target(id);
  if (t.role === "admin" && !by.isAdmin) throw new UserError("Moderators can't do that to admins.");
  kick(id);
  audit(by.id, "log out everywhere", t.username);
}

export function deleteMember(by: User, id: number) {
  if (!by.isAdmin) throw new UserError("Only admins can delete accounts.");
  const t = target(id);
  if (t.id === by.id) throw new UserError("Close your own account under Settings → Account.");
  kick(id);
  db().prepare("delete from users where id = ?").run(id);
  audit(by.id, "delete member", t.username);
}

export async function addMember(by: User, o: { username: string; name: string; role: Role }): Promise<string> {
  if (!by.isAdmin) throw new UserError("Only admins can add members.");
  const { createUser, validateNewUser } = await import("./accounts");
  const pw = randomToken(9);
  const err = validateNewUser(o.username, o.name, pw);
  if (err) throw new UserError(err);
  await createUser({ username: o.username, name: o.name, password: pw, role: o.role, invitedBy: by.id });
  audit(by.id, "add member", o.username);
  return pw;
}

export async function setPasswordFor(by: User, id: number, pw: string) {
  if (!by.isAdmin) throw new UserError("Only admins can set passwords.");
  if (pw.length < 8) throw new UserError("Passwords need at least 8 characters.");
  const t = target(id);
  db().prepare("update users set password_hash = ? where id = ?").run(await hashPassword(pw), id);
  kick(id);
  audit(by.id, "set password", t.username);
}

export function auditLog(limit = 200) {
  const rows = db().prepare("select a.*, u.display_name name from audit_log a left join users u on u.id = a.actor_id order by a.id desc limit ?").all(limit) as {
    id: number;
    name: string | null;
    action: string;
    target: string;
    detail: string;
    created_at: number;
  }[];
  return rows.map((r) => ({ id: r.id, who: r.name ?? "—", action: r.action, target: r.target, detail: r.detail, at: r.created_at }));
}

/** Everything back into the search index (after an import, or if search seems off). */
export function reindexAll(): number {
  // titles kept in the index, so in the site's language (as when they were first indexed)
  const tr = serverT();
  let n = 0;
  tx(() => {
    db().prepare("delete from search_index").run();
    for (const p of db().prepare("select * from posts").all() as { id: number; kind: "post" | "news"; title: string; body_text: string; visibility: string; group_id: number | null; author_id: number; created_at: number }[]) {
      indexItem(p.kind, p.id, p.visibility === "private" ? `u:${p.author_id}` : groupScope(p.group_id), p.author_id, p.created_at, p.title || p.body_text.slice(0, 80), p.body_text);
      n++;
    }
    for (const t of db().prepare("select t.*, c.group_id from forum_threads t join forum_categories c on c.id = t.category_id").all() as { id: number; title: string; body_text: string; author_id: number; created_at: number; group_id: number | null }[]) {
      indexItem("thread", t.id, groupScope(t.group_id), t.author_id, t.created_at, t.title, t.body_text);
      n++;
    }
    for (const r of db().prepare("select p.*, t.title, c.group_id from forum_posts p join forum_threads t on t.id = p.thread_id join forum_categories c on c.id = t.category_id").all() as { id: number; title: string; body_text: string; author_id: number; created_at: number; group_id: number | null }[]) {
      indexItem("reply", r.id, groupScope(r.group_id), r.author_id, r.created_at, r.title, r.body_text);
      n++;
    }
    for (const p of db().prepare("select * from polls").all() as { id: number; question: string; description_text: string; author_id: number; created_at: number; group_id: number | null }[]) {
      const opts = (db().prepare("select label from poll_options where poll_id = ?").all(p.id) as { label: string }[]).map((o) => o.label).join(" · ");
      indexItem("poll", p.id, groupScope(p.group_id), p.author_id, p.created_at, p.question, `${opts} ${p.description_text}`);
      n++;
    }
    for (const e of db().prepare("select * from events").all() as { id: number; title: string; location: string; description_text: string; author_id: number; created_at: number; group_id: number | null }[]) {
      indexItem("event", e.id, groupScope(e.group_id), e.author_id, e.created_at, e.title, `${e.location} ${e.description_text}`);
      n++;
    }
    for (const m of db().prepare("select m.*, r.name, r.kind rk from messages m join rooms r on r.id = m.room_id where m.deleted = 0 and m.kind = 'text'").all() as { id: number; room_id: number; body_text: string; author_id: number; created_at: number; name: string; rk: string }[]) {
      indexItem("message", m.id, `r:${m.room_id}`, m.author_id, m.created_at, m.rk === "dm" ? tr("Direct message") : m.name, m.body_text);
      n++;
    }
    for (const c of db().prepare("select * from comments").all() as { id: number; target_type: string; target_id: number; author_id: number; body_text: string; created_at: number }[]) {
      const table = c.target_type === "post" ? "posts" : c.target_type === "poll" ? "polls" : "events";
      const t = db().prepare(`select * from ${table} where id = ?`).get(c.target_id) as { group_id: number | null; visibility?: string; author_id: number } | undefined;
      if (!t) continue;
      // comments on an "only me" post stay with its author
      const scope = t.visibility === "private" ? `u:${t.author_id}` : groupScope(t.group_id);
      indexItem("comment", c.id, scope, c.author_id, c.created_at, tr("Comment"), c.body_text);
      n++;
    }
    for (const g of db().prepare("select * from groups").all() as { id: number; name: string; tagline: string; privacy: string; owner_id: number; created_at: number }[]) {
      indexItem("group", g.id, g.privacy === "secret" ? `g:${g.id}` : "members", g.owner_id, g.created_at, g.name, g.tagline);
      n++;
    }
    for (const r of db().prepare("select * from rooms where kind = 'room'").all() as { id: number; name: string; topic: string; visibility: string; owner_id: number; created_at: number }[]) {
      indexItem("room", r.id, r.visibility === "private" ? `r:${r.id}` : "members", r.owner_id, r.created_at, r.name, r.topic);
      n++;
    }
    for (const u of db().prepare("select * from users where banned = 0").all() as UserRow[]) {
      indexItem("user", u.id, "members", u.id, u.created_at, u.display_name, `${u.username} ${u.location}`);
      n++;
    }
  });
  return n;
}

export function vacuum() {
  db().pragma("wal_checkpoint(TRUNCATE)");
  db().exec("vacuum");
}

/** A consistent copy of the database, for downloading. */
export async function backupFile(): Promise<string> {
  const dir = path.join(DATA_DIR, "backups");
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (fs.statSync(path.join(dir, f)).mtimeMs < now() - 86_400_000) fs.rmSync(path.join(dir, f), { force: true });
  const file = path.join(dir, `hooden-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.db`);
  await db().backup(file);
  return file;
}

export function system() {
  const mem = process.memoryUsage();
  return {
    version: process.env.HOODEN_VERSION || "dev",
    node: process.version,
    uptime: process.uptime(),
    rss: mem.rss,
    heap: mem.heapUsed,
    dataDir: DATA_DIR,
    uploadDir: UPLOAD_DIR,
    publicUrl: process.env.PUBLIC_URL || "",
    tz: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
