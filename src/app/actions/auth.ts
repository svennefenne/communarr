"use server";

import { redirect } from "next/navigation";
import { db, now } from "@/lib/db";
import { audit, clientInfo, hasAnyUser, hashPassword, startSession } from "@/lib/auth";
import { announceNewMember, createUser, inviteState, seedSite, redeemInvite, undoSignup, validateNewUser } from "@/lib/accounts";
import { getSettings } from "@/lib/settings";
import { requestT } from "@/lib/t";
import { emailTaken, forgotPassword, setAllMail, startConfirmation, throttled } from "@/lib/accountMail";
import { mailReady, normEmail, validEmail } from "@/lib/mail";
import { UserError } from "@/lib/errors";
import { logIn } from "@/lib/login";

export interface FormState {
  error?: string;
  ok?: string;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

/** Back to where you were, but only somewhere on this site ("/\evil.example" is another site to a browser). */
function safeNext(next: string) {
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.startsWith("/login")) return "/";
  try {
    const u = new URL(next, "http://communarr.invalid");
    return u.origin === "http://communarr.invalid" ? u.pathname + u.search + u.hash : "/";
  } catch {
    return "/";
  }
}

export async function setupAction(_: FormState, fd: FormData): Promise<FormState> {
  if (hasAnyUser()) redirect("/login");
  const username = str(fd, "username").trim();
  // (optional: without one, the username shows)
  const alias = str(fd, "alias").trim();
  const password = str(fd, "password");
  const err = validateNewUser(username, alias, password, str(fd, "password2"));
  if (err) return { error: (await requestT())(err) };
  const id = await createUser({ username, alias, password, role: "admin" });
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
  const r = await logIn(str(fd, "username").trim(), str(fd, "password"));
  if (r) return r;
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
  // (optional: without one, the username shows)
  const alias = str(fd, "alias").trim();
  const name = alias || username;
  const password = str(fd, "password");
  const err = validateNewUser(username, alias, password, str(fd, "password2"));
  if (err) return { error: t(err) };
  // with mail: an address is needed, and the account opens when the link mailed to it is clicked
  const mail = mailReady();
  const email = normEmail(str(fd, "email"));
  if (mail) {
    if (!validEmail(email)) return { error: t("Write your email address: your account opens when you click the link we send to it.") };
    if (emailTaken(email)) return { error: t("Another account uses that address.") };
    // (each sign-up sends a mail: not a way to fill someone's inbox)
    if (throttled(`signup:${(await clientInfo()).ip || "?"}`, 5, 60 * 60_000)) return { error: t("That's a lot of mails: wait a while and try again.") };
  }
  const pending = !invite && s.approveNew;
  const waiting = mail ? (pending ? "unconfirmed pending" : "unconfirmed") : pending ? "pending" : undefined;
  const id = await createUser({ username, alias, password, role: invite?.role === "moderator" ? "moderator" : "member", invitedBy: invite?.created_by ?? null, waiting });
  if (invite) redeemInvite(invite, id);
  if (mail) {
    try {
      await startConfirmation({ id, username, name }, email, { signup: true });
    } catch (e) {
      // no mail, no way in: the sign-up is undone so they can try again
      undoSignup(id, invite);
      return { error: e instanceof UserError ? e.translated(t) : t("The mail couldn't be sent. Try again later, or tell an admin.") };
    }
    audit(id, "signup", username, invite ? `invite ${invite.code}` : "open");
    return { ok: t("Almost there! We've sent a link to {email}. Click it to open your account (it works for 48 hours), then log in. Nothing there? Look in the spam folder.", { email }) };
  }
  audit(id, "signup", username, invite ? `invite ${invite.code}` : "open");
  announceNewMember(id, pending);
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
