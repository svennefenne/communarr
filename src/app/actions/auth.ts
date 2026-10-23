"use server";

import { redirect } from "next/navigation";
import { db, now } from "@/lib/db";
import { audit, clearFailures, clientInfo, hasAnyUser, hashPassword, noteFailure, startSession, tooManyAttempts, verifyPassword } from "@/lib/auth";
import { createUser, inviteState, pendingUser, seedSite, redeemInvite, validateNewUser } from "@/lib/accounts";
import { getSettings } from "@/lib/settings";
import { notify } from "@/lib/notify";
import type { UserRow } from "@/lib/users";

export interface FormState {
  error?: string;
  ok?: string;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

/** Back to where you were, but only somewhere on this site ("/\evil.example" is another site to a browser). */
function safeNext(next: string) {
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.startsWith("/login")) return "/";
  try {
    const u = new URL(next, "http://hooden.invalid");
    return u.origin === "http://hooden.invalid" ? u.pathname + u.search + u.hash : "/";
  } catch {
    return "/";
  }
}

export async function setupAction(_: FormState, fd: FormData): Promise<FormState> {
  if (hasAnyUser()) redirect("/login");
  const username = str(fd, "username").trim();
  const name = str(fd, "name").trim() || username;
  const password = str(fd, "password");
  const err = validateNewUser(username, name, password, str(fd, "password2"));
  if (err) return { error: err };
  const id = await createUser({ username, name, password, role: "admin" });
  seedSite(id);
  // the admin joins the rooms made just now
  const t = now();
  for (const r of db().prepare("select id from rooms").all() as { id: number }[]) db().prepare("insert or ignore into room_members (room_id, user_id, role, joined_at) values (?, ?, 'owner', ?)").run(r.id, id, t);
  const siteName = str(fd, "siteName").trim();
  if (siteName) db().prepare("insert into settings (key, value) values ('siteName', ?) on conflict(key) do update set value = excluded.value").run(JSON.stringify(siteName.slice(0, 40)));
  await startSession(id);
  audit(id, "setup", username);
  redirect("/");
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const username = str(fd, "username").trim();
  const password = str(fd, "password");
  const { ip } = await clientInfo();
  const name = username.toLowerCase();
  // per address (when there is one) and per name from anywhere: made-up addresses don't help
  const key = ip ? `${ip}|${name}` : null;
  const nameKey = `*|${name}`;
  if ((key && tooManyAttempts(key)) || tooManyAttempts(nameKey, 30)) return { error: "Too many tries. Wait ten minutes and try again." };
  const row = db().prepare("select * from users where username = ?").get(username) as UserRow | undefined;
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    if (key) noteFailure(key);
    noteFailure(nameKey);
    return { error: "That username and password don't match." };
  }
  if (row.banned) return { error: `This account has been closed${row.ban_reason ? `: ${row.ban_reason}` : "."}` };
  if (pendingUser(row)) return { error: "Your account is waiting for an admin to let you in. Try again a bit later." };
  if (row.suspended_until && row.suspended_until > now()) {
    return { error: `This account is suspended until ${new Date(row.suspended_until).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.` };
  }
  if (key) clearFailures(key);
  await startSession(row.id);
  redirect(safeNext(str(fd, "next")));
}

export async function signupAction(_: FormState, fd: FormData): Promise<FormState> {
  const s = getSettings();
  const code = str(fd, "code");
  let invite = null;
  if (code) {
    const st = inviteState(code);
    if (!st.ok) return { error: st.error };
    invite = st.invite;
  } else if (s.registration !== "open") {
    return { error: "You need an invite link to join." };
  }
  const username = str(fd, "username").trim();
  const name = str(fd, "name").trim() || username;
  const password = str(fd, "password");
  const err = validateNewUser(username, name, password, str(fd, "password2"));
  if (err) return { error: err };
  const pending = !invite && s.approveNew;
  const id = await createUser({ username, name, password, role: invite?.role === "moderator" ? "moderator" : "member", invitedBy: invite?.created_by ?? null, pending });
  if (invite) redeemInvite(invite, id);
  audit(id, "signup", username, invite ? `invite ${invite.code}` : "open");
  // let the admins know someone joined (or is waiting)
  const admins = (db().prepare("select id from users where role = 'admin'").all() as { id: number }[]).map((a) => a.id);
  notify(admins, {
    kind: "group",
    actorId: id,
    title: pending ? `${name} wants to join` : `${name} joined`,
    body: pending ? "Let them in under Admin → Members." : `Say hi to @${username}!`,
    url: pending ? "/admin#members" : `/u/${encodeURIComponent(username)}`,
  });
  if (pending) return { ok: "Thanks! An admin will let you in soon; then you can log in." };
  await startSession(id);
  redirect("/?welcome=1");
}

export async function resetAction(_: FormState, fd: FormData): Promise<FormState> {
  const token = str(fd, "token");
  const row = db().prepare("select * from resets where token = ? and used = 0").get(token) as { user_id: number; expires_at: number } | undefined;
  if (!row || row.expires_at < now()) return { error: "This link doesn't work any more. Ask an admin for a new one." };
  const password = str(fd, "password");
  if (password.length < 8) return { error: "Passwords need at least 8 characters." };
  if (password !== str(fd, "password2")) return { error: "The two passwords aren't the same." };
  db().prepare("update users set password_hash = ? where id = ?").run(await hashPassword(password), row.user_id);
  db().prepare("update resets set used = 1 where token = ?").run(token);
  db().prepare("delete from sessions where user_id = ?").run(row.user_id);
  audit(row.user_id, "password reset");
  await startSession(row.user_id);
  redirect("/");
}
