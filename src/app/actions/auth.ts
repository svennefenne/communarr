"use server";

import { redirect } from "next/navigation";
import { db, now } from "@/lib/db";
import { audit, clearFailures, clientInfo, hasAnyUser, hashPassword, noteFailure, startSession, tooManyAttempts, verifyPassword } from "@/lib/auth";
import { createUser, inviteState, pendingUser, seedSite, redeemInvite, validateNewUser } from "@/lib/accounts";
import { getSettings } from "@/lib/settings";
import { notify } from "@/lib/notify";
import { memberLang, requestT, setLangCookie } from "@/lib/t";
import type { UserRow } from "@/lib/users";
import { forgotPassword, setAllMail, startConfirmation } from "@/lib/accountMail";
import { mailReady } from "@/lib/mail";
import { UserError } from "@/lib/errors";

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
  if (err) return { error: (await requestT())(err) };
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
  const t = await requestT();
  const name = username.toLowerCase();
  // per address (when there is one) and per name from anywhere: made-up addresses don't help
  const key = ip ? `${ip}|${name}` : null;
  const nameKey = `*|${name}`;
  if ((key && tooManyAttempts(key)) || tooManyAttempts(nameKey, 30)) return { error: t("Too many tries. Wait ten minutes and try again.") };
  const row = db().prepare("select * from users where username = ?").get(username) as UserRow | undefined;
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    if (key) noteFailure(key);
    noteFailure(nameKey);
    return { error: t("That username and password don't match.") };
  }
  if (row.banned) return { error: row.ban_reason ? t("This account has been closed: {reason}", { reason: row.ban_reason }) : t("This account has been closed.") };
  if (pendingUser(row)) return { error: t("Your account is waiting for an admin to let you in. Try again a bit later.") };
  if (row.suspended_until && row.suspended_until > now()) {
    return { error: t("This account is suspended until {date}.", { date: new Date(row.suspended_until).toLocaleString(t.locale ?? "en-GB", { dateStyle: "medium", timeStyle: "short" }) }) };
  }
  if (key) clearFailures(key);
  await startSession(row.id);
  // their own language, so this browser's log-in page keeps it after logging out
  const own = memberLang(row.id);
  if (own) await setLangCookie(own);
  redirect(safeNext(str(fd, "next")));
}

export async function signupAction(_: FormState, fd: FormData): Promise<FormState> {
  const s = getSettings();
  const t = await requestT();
  const code = str(fd, "code");
  let invite = null;
  if (code) {
    const st = inviteState(code);
    if (!st.ok) return { error: t(st.error) };
    invite = st.invite;
  } else if (s.registration !== "open") {
    return { error: t("You need an invite link to join.") };
  }
  const username = str(fd, "username").trim();
  const name = str(fd, "name").trim() || username;
  const password = str(fd, "password");
  const err = validateNewUser(username, name, password, str(fd, "password2"));
  if (err) return { error: t(err) };
  const pending = !invite && s.approveNew;
  const id = await createUser({ username, name, password, role: invite?.role === "moderator" ? "moderator" : "member", invitedBy: invite?.created_by ?? null, pending });
  if (invite) redeemInvite(invite, id);
  audit(id, "signup", username, invite ? `invite ${invite.code}` : "open");
  // an address (optional): a link to confirm it; a bad one, or a mail that doesn't go, doesn't stop the sign-up
  const email = str(fd, "email").trim();
  if (email && mailReady()) await startConfirmation({ id, username, name }, email).catch(() => {});
  // let the admins know someone joined (or is waiting)
  const admins = (db().prepare("select id from users where role = 'admin'").all() as { id: number }[]).map((a) => a.id);
  notify(admins, {
    kind: "group",
    actorId: id,
    title: pending ? "{name} wants to join" : "{name} joined",
    body: pending ? "Let them in under Admin → Members." : "Say hi to @{username}!",
    vars: { name, username },
    url: pending ? "/admin#members" : `/u/${encodeURIComponent(username)}`,
  });
  if (pending) return { ok: t("Thanks! An admin will let you in soon; then you can log in.") };
  await startSession(id);
  redirect("/?welcome=1");
}

export async function resetAction(_: FormState, fd: FormData): Promise<FormState> {
  const token = str(fd, "token");
  const t = await requestT();
  const row = db().prepare("select * from resets where token = ? and used = 0").get(token) as { user_id: number; expires_at: number } | undefined;
  const gone = mailReady() ? t("This link doesn't work any more. Get a new one under “Forgot your password?” on the log-in page, or ask an admin.") : t("This link doesn't work any more. Ask an admin for a new one.");
  if (!row || row.expires_at < now()) return { error: gone };
  const password = str(fd, "password");
  if (password.length < 8) return { error: t("Passwords need at least 8 characters.") };
  if (password !== str(fd, "password2")) return { error: t("The two passwords aren't the same.") };
  const hash = await hashPassword(password);
  // once: two tabs sending the form at the same moment can't both use it
  if (!db().prepare("update resets set used = 1 where token = ? and used = 0 and expires_at > ?").run(token, now()).changes) return { error: gone };
  db().prepare("update users set password_hash = ? where id = ?").run(hash, row.user_id);
  db().prepare("delete from sessions where user_id = ?").run(row.user_id);
  audit(row.user_id, "password reset");
  await startSession(row.user_id);
  redirect("/");
}

/** /forgot: mail the username and a link for a new password to the account's confirmed address. */
export async function forgotAction(_: FormState, fd: FormData): Promise<FormState> {
  const t = await requestT();
  if (!mailReady()) return { error: t("This site can't send mail yet. Ask an admin for a password reset link.") };
  const who = str(fd, "who").trim();
  if (!who) return { error: t("Write your username or email address.") };
  try {
    await forgotPassword(who, (await clientInfo()).ip);
  } catch (e) {
    if (e instanceof UserError) return { error: e.translated(t) };
    throw e;
  }
  // the same answer either way, so the page doesn't tell who has an account
  return { ok: t("If that account has a confirmed email address, a mail with the username and a link for a new password is on its way. The link works for an hour. Nothing there? Look in the spam folder, or ask an admin.") };
}

/** The "stop all notification mails" link (no log-in needed: the key in the link is enough). */
export async function unsubscribeAction(_: FormState, fd: FormData): Promise<FormState> {
  const t = await requestT();
  if (!setAllMail(str(fd, "token"), false)) return { error: t("This link doesn't work.") };
  return { ok: t("Done: no more notification mails. Mails about your account (a forgotten password) still come.") };
}

export async function resubscribeAction(_: FormState, fd: FormData): Promise<FormState> {
  const t = await requestT();
  if (!setAllMail(str(fd, "token"), true)) return { error: t("This link doesn't work.") };
  return { ok: t("Notification mails are back on: direct messages, @mentions, invitations and news, while you're away. Choose more under Settings → Notifications.") };
}
