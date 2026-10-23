import "server-only";
import { db, now, tx } from "./db";
import { hashPassword, randomToken } from "./auth";
import { USERNAME_RE, type UserRow } from "./users";
import type { Role } from "./types";
import { indexItem } from "./search";
import { getSettings } from "./settings";

export function validateNewUser(username: string, name: string, password: string, password2?: string): string | null {
  if (!USERNAME_RE.test(username)) return "Usernames are 2–24 letters, numbers, dots, dashes or underscores.";
  if (["admin", "system", "ghost", "me", "new", "settings", "hooden"].includes(username.toLowerCase()) && hasUsers()) return "That username is taken.";
  if (db().prepare("select 1 from users where username = ?").get(username)) return "That username is taken.";
  if (!name.trim()) return "Tell us what to call you.";
  if (name.trim().length > 40) return "That name is a bit long (40 letters at most).";
  if (password.length < 8) return "Passwords need at least 8 characters.";
  if (password2 !== undefined && password !== password2) return "The two passwords aren't the same.";
  return null;
}

function hasUsers() {
  return !!db().prepare("select 1 from users limit 1").get();
}

/** Make an account, and put the new member in the site's open chat rooms. */
export async function createUser(o: { username: string; name: string; password: string; role?: Role; invitedBy?: number | null; pending?: boolean }): Promise<number> {
  const hash = await hashPassword(o.password);
  return tx(() => {
    const t = now();
    const id = Number(
      db()
        .prepare("insert into users (username, display_name, password_hash, role, invited_by, created_at, suspended_until, ban_reason) values (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(o.username, o.name.trim(), hash, o.role ?? "member", o.invitedBy ?? null, t, o.pending ? 9_999_999_999_999 : null, o.pending ? "pending" : null).lastInsertRowid,
    );
    const rooms = db().prepare("select id from rooms where kind = 'room' and visibility = 'open' and group_id is null and archived = 0").all() as { id: number }[];
    const join = db().prepare("insert or ignore into room_members (room_id, user_id, joined_at, last_read_id) values (?, ?, ?, (select coalesce(max(id), 0) from messages where room_id = ?))");
    for (const r of rooms) join.run(r.id, id, t, r.id);
    indexItem("user", id, "members", id, t, o.name, o.username);
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

export function inviteState(code: string): { ok: true; invite: InviteRow } | { ok: false; error: string } {
  const inv = db().prepare("select * from invites where code = ?").get(code) as InviteRow | undefined;
  if (!inv || inv.revoked) return { ok: false, error: "This invite link doesn't work any more. Ask for a new one." };
  if (inv.expires_at && inv.expires_at < now()) return { ok: false, error: "This invite link has expired. Ask for a new one." };
  if (inv.max_uses != null && inv.uses >= inv.max_uses) return { ok: false, error: "This invite link has been used up. Ask for a new one." };
  return { ok: true, invite: inv };
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
  tx(() => {
    const cats: [string, string, string, string, string][] = [
      ["general", "General", "Anything and everything.", "💬", "#d65a2b"],
      ["plans", "Plans & meetups", "Trips, game nights, dinners: let's make it happen.", "🗓️", "#e2a634"],
      ["games-media", "Games, films & music", "What you're playing, watching and listening to.", "🎮", "#2f7088"],
      ["off-topic", "Off-topic", "Memes, links and the rest.", "🌀", "#4f8f50"],
      ["site", "About the site", "Ideas, wishes and bugs for this place.", "🛠️", "#9c5bb5"],
    ];
    cats.forEach(([slug, name, desc, icon, color], i) =>
      db().prepare("insert into forum_categories (slug, name, description, icon, color, position, created_at) values (?, ?, ?, ?, ?, ?, ?)").run(slug, name, desc, icon, color, i, t),
    );
    const rooms: [string, string, string][] = [
      ["Lounge", "Hang out, say hi, talk about whatever.", "🛋️"],
      ["Gaming", "Who's up for a game?", "🎮"],
    ];
    for (const [name, topic, emoji] of rooms) {
      const id = Number(db().prepare("insert into rooms (name, topic, emoji, kind, visibility, owner_id, created_at, last_message_at) values (?, ?, ?, 'room', 'open', ?, ?, ?)").run(name, topic, emoji, adminId, t, t).lastInsertRowid);
      db().prepare("insert into room_members (room_id, user_id, role, joined_at) values (?, ?, 'owner', ?)").run(id, adminId, t);
      db().prepare("insert into messages (room_id, author_id, kind, body_html, body_text, created_at) values (?, null, 'system', ?, ?, ?)").run(id, `<p>${name} is open. ${topic}</p>`, `${name} is open.`, t);
    }
    const s = getSettings();
    const html = `<p>This is <strong>${s.siteName}</strong>: our own place to hang around, chat, plan and argue about films. A few things to try:</p><ul><li><p>Write a post right here on the front page (pictures and links welcome).</p></li><li><p>Jump into the <strong>Lounge</strong> under Chat, and press the headphones to talk.</p></li><li><p>Plan something in the <strong>Calendar</strong>, ask something in <strong>Polls</strong>, start a thread in the <strong>Forum</strong>.</p></li><li><p>Make the place yours under <strong>Theme</strong>: 98 colour schemes, or build your own with your own background.</p></li></ul><p>On your phone? Add the site to your home screen and turn on notifications under Settings.</p>`;
    const id = Number(
      db()
        .prepare("insert into posts (author_id, kind, title, body_html, body_text, visibility, pinned, created_at) values (?, 'news', ?, ?, ?, 'members', 1, ?)")
        .run(adminId, `Welcome to ${s.siteName}`, html, html.replace(/<[^>]+>/g, " "), t).lastInsertRowid,
    );
    indexItem("news", id, "members", adminId, t, `Welcome to ${s.siteName}`, html.replace(/<[^>]+>/g, " "));
  });
}

export function pendingUser(r: UserRow) {
  return r.ban_reason === "pending" && (r.suspended_until ?? 0) > now();
}
