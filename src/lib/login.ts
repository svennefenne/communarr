import { db, now } from "@/lib/db";
import { clearFailures, clientInfo, noteFailure, startSession, tooManyAttempts, verifyPassword } from "@/lib/auth";
import { pendingUser } from "@/lib/accounts";
import { resendSignupLink } from "@/lib/accountMail";
import { getSettings } from "@/lib/settings";
import { memberLang, requestT, setLangCookie } from "@/lib/t";
import { isUnconfirmed, type UserRow } from "@/lib/users";
import { hourCycle } from "@/lib/clock";
import { maskEmail } from "@/lib/mail";

/**
 * Log in with a username and password, for the site's log-in page and the Android app's own screen:
 * tries are limited, and a closed, unconfirmed, waiting or suspended account doesn't get in. Starts a
 * session (its cookie) and returns nothing when it worked; otherwise what to tell them (error, or ok for
 * a note such as a new confirmation mail).
 */
export async function logIn(username: string, password: string): Promise<{ error?: string; ok?: string } | null> {
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
  // signed up but hasn't clicked the link yet: a new one (the right password shows it's them)
  if (isUnconfirmed(row)) {
    const to = await resendSignupLink(row);
    return to
      ? { ok: t("Your account opens when you confirm your email address. We've sent a new link to {email}: click it, then log in.", { email: maskEmail(to) }) }
      : { error: t("Your account opens when you confirm your email address: click the link in the mail we sent (look in the spam folder too). No mail? Ask an admin to let you in.") };
  }
  if (pendingUser(row)) return { error: t("Your account is waiting for an admin to let you in. Try again a bit later.") };
  if (row.suspended_until && row.suspended_until > now()) {
    return { error: t("This account is suspended until {date}.", { date: new Date(row.suspended_until).toLocaleString(t.locale ?? "en-GB", { dateStyle: "medium", timeStyle: "short", ...hourCycle(getSettings()) }) }) };
  }
  if (key) clearFailures(key);
  await startSession(row.id);
  // their own language, so this browser's log-in page keeps it after logging out
  const own = memberLang(row.id);
  if (own) await setLangCookie(own);
  return null;
}
