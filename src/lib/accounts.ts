import "server-only";
import { db, now, tx } from "./db";
import { hashPassword, randomToken } from "./auth";
import { USERNAME_RE, type UserRow, type Waiting } from "./users";
import { notify } from "./notify";
import type { Role } from "./types";
import { indexItem } from "./search";
import { getSettings } from "./settings";
import { serverT } from "./t";

/** What's wrong with a new account, as English text (translate it where it's shown: t(err)), or null. */
export function validateNewUser(username: string, alias: string, password: string, password2?: string): string | null {
  if (!USERNAME_RE.test(username)) return "Usernames are 2–24 letters, numbers, dots, dashes or underscores.";
  if (["admin", "system", "ghost", "me", "new", "settings", "communarr", "hooden"].includes(username.toLowerCase()) && hasUsers()) return "That username is taken.";
  if (db().prepare("select 1 from users where username = ?").get(username)) return "That username is taken.";
  // (the alias is optional: without one, the username shows)
  if (alias.trim().length > 40) return "That alias is a bit long (40 letters at most).";
  if (password.length < 8) return "Passwords need at least 8 characters.";
  if (password2 !== undefined && password !== password2) return "The two passwords aren't the same.";
  return null;
}

function hasUsers() {
  return !!db().prepare("select 1 from users limit 1").get();
}

/**
 * Make an account (one that's waiting can't log in yet), and put the new member in the site's open
 * chat rooms. The alias is optional: without one, the username is what's shown.
 */
export async function createUser(o: { username: string; alias?: string; password: string; role?: Role; invitedBy?: number | null; waiting?: Waiting }): Promise<number> {
  const hash = await hashPassword(o.password);
  const alias = o.alias?.trim().slice(0, 40) || null;
  const shown = alias ?? o.username;
  return tx(() => {
    const t = now();
    const id = Number(
      db()
        .prepare("insert into users (username, display_name, alias, password_hash, role, invited_by, created_at, suspended_until, ban_reason) values (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(o.username, shown, alias, hash, o.role ?? "member", o.invitedBy ?? null, t, o.waiting ? 9_999_999_999_999 : null, o.waiting ?? null).lastInsertRowid,
    );
    const rooms = db().prepare("select id from rooms where kind = 'room' and visibility = 'open' and group_id is null and archived = 0").all() as { id: number }[];
    const join = db().prepare("insert or ignore into room_members (room_id, user_id, joined_at, last_read_id) values (?, ?, ?, (select coalesce(max(id), 0) from messages where room_id = ?))");
    for (const r of rooms) join.run(r.id, id, t, r.id);
    indexItem("user", id, "members", id, t, shown, o.username);
    return id;
  });
}

export interface InviteRow {
  code: string;
  created_by: number | null;
  note: string;
  max_uses: number | null;
  uses: number;
  expires_at: number | null;
  role: Role;
  group_id: number | null;
  revoked: number;
  created_at: number;
}

/** Whether an invite link still works; `error` is English text to translate where it's shown. */
export function inviteState(code: string): { ok: true; invite: InviteRow } | { ok: false; error: string } {
  const inv = db().prepare("select * from invites where code = ?").get(code) as InviteRow | undefined;
  if (!inv || inv.revoked) return { ok: false, error: "This invite link doesn't work any more. Ask for a new one." };
  if (inv.expires_at && inv.expires_at < now()) return { ok: false, error: "This invite link has expired. Ask for a new one." };
  if (inv.max_uses != null && inv.uses >= inv.max_uses) return { ok: false, error: "This invite link has been used up. Ask for a new one." };
  return { ok: true, invite: inv };
}

/** A sign-up that couldn't go on (its confirmation mail didn't go): gone again, and the invite use given back. */
export function undoSignup(userId: number, inv: InviteRow | null) {
  tx(() => {
    db().prepare("delete from users where id = ?").run(userId);
    if (inv) db().prepare("update invites set uses = max(uses - 1, 0) where code = ?").run(inv.code);
  });
}

/** Tell the admins someone joined, or is waiting for them to let them in. */
export function announceNewMember(userId: number, pending: boolean) {
  const u = db().prepare("select username, display_name from users where id = ?").get(userId) as { username: string; display_name: string } | undefined;
  if (!u) return;
  const admins = (db().prepare("select id from users where role = 'admin'").all() as { id: number }[]).map((a) => a.id);
  notify(admins, {
    kind: "group",
    actorId: userId,
    title: pending ? "{name} wants to join" : "{name} joined",
    body: pending ? "Let them in under Admin → Members." : "Say hi to @{username}!",
    vars: { name: u.display_name, username: u.username },
    url: pending ? "/admin#members" : `/u/${encodeURIComponent(u.username)}`,
  });
}

export function redeemInvite(inv: InviteRow, userId: number) {
  db().prepare("update invites set uses = uses + 1 where code = ?").run(inv.code);
  db().prepare("insert into invite_uses (code, user_id, at) values (?, ?, ?)").run(inv.code, userId, now());
  if (inv.group_id) db().prepare("insert or ignore into group_members (group_id, user_id, role, joined_at) values (?, ?, 'member', ?)").run(inv.group_id, userId, now());
}

export function createInvite(by: number, o: { note?: string; maxUses?: number | null; days?: number | null; role?: Role; groupId?: number | null }): string {
  const code = randomToken(9);
  db()
    .prepare("insert into invites (code, created_by, note, max_uses, expires_at, role, group_id, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(code, by, (o.note || "").slice(0, 80), o.maxUses ?? null, o.days ? now() + o.days * 86_400_000 : null, o.role ?? "member", o.groupId ?? null, now());
  return code;
}

/** The first visit: the admin's account, and a site that isn't empty. */
export function seedSite(adminId: number) {
  const t = now();
  const tr = serverT();
  tx(() => {
    const cats: [string, string, string, string, string][] = [
      ["general", "General", "Anything and everything.", "💬", "#d65a2b"],
      ["plans", "Plans & meetups", "Trips, game nights, dinners: let's make it happen.", "🗓️", "#e2a634"],
      ["games-media", "Games, films & music", "What you're playing, watching and listening to.", "🎮", "#2f7088"],
      ["off-topic", "Off-topic", "Memes, links and the rest.", "🌀", "#4f8f50"],
      ["site", "About the site", "Ideas, wishes and bugs for this place.", "🛠️", "#9c5bb5"],
    ];
    cats.forEach(([slug, name, desc, icon, color], i) =>
      db().prepare("insert into forum_categories (slug, name, description, icon, color, position, created_at) values (?, ?, ?, ?, ?, ?, ?)").run(slug, tr(name), tr(desc), icon, color, i, t),
    );
    const rooms: [string, string, string][] = [
      [tr("Lounge"), tr("Hang out, say hi, talk about whatever."), "🛋️"],
      [tr("Gaming"), tr("Who's up for a game?"), "🎮"],
    ];
    for (const [name, topic, emoji] of rooms) {
      const id = Number(db().prepare("insert into rooms (name, topic, emoji, kind, visibility, owner_id, created_at, last_message_at) values (?, ?, ?, 'room', 'open', ?, ?, ?)").run(name, topic, emoji, adminId, t, t).lastInsertRowid);
      db().prepare("insert into room_members (room_id, user_id, role, joined_at) values (?, ?, 'owner', ?)").run(id, adminId, t);
      const open = tr("{name} is open.", { name });
      db().prepare("insert into messages (room_id, author_id, kind, body_html, body_text, created_at) values (?, null, 'system', ?, ?, ?)").run(id, `<p>${open} ${topic}</p>`, open, t);
    }
    const s = getSettings();
    const html = tr(
      "<p>This is <strong>{site}</strong>: our own place to hang around, chat, plan and argue about films. A few things to try:</p><ul><li><p>Write a post right here on the front page (pictures and links welcome).</p></li><li><p>Jump into the <strong>{lounge}</strong> under Chat, and press the headphones to talk.</p></li><li><p>Plan something in the <strong>Calendar</strong>, ask something in <strong>Polls</strong>, start a thread in the <strong>Forum</strong>.</p></li><li><p>Make the place yours under <strong>Theme</strong>: 98 colour schemes, or build your own with your own background.</p></li></ul><p>On your phone? Add the site to your home screen and turn on notifications under Settings.</p>",
      { site: s.siteName, lounge: rooms[0][0] },
    );
    const title = tr("Welcome to {site}", { site: s.siteName });
    const id = Number(
      db()
        .prepare("insert into posts (author_id, kind, title, body_html, body_text, visibility, pinned, created_at) values (?, 'news', ?, ?, ?, 'members', 1, ?)")
        .run(adminId, title, html, html.replace(/<[^>]+>/g, " "), t).lastInsertRowid,
    );
    indexItem("news", id, "members", adminId, t, title, html.replace(/<[^>]+>/g, " "));
  });
}

export function pendingUser(r: UserRow) {
  return r.ban_reason === "pending" && (r.suspended_until ?? 0) > now();
}
