import "server-only";
import { audit, randomToken } from "./auth";
import { db, now, tx } from "./db";
import { UserError } from "./errors";
import { connsOf } from "./hub";
import { mailReady, normEmail, sendMail, validEmail } from "./mail";
import { confirmMail, notificationMail, recoveryMail } from "./mailTemplates";
import { getSettings } from "./settings";
import { userT } from "./t";
import { baseUrl } from "./url";
import { MAIL_KINDS, toUser, type User, type UserRow } from "./users";
import { NOTIFY_KINDS, type NotifyKind, type NotifyPrefs } from "./types";

/**
 * The mails about someone's account and what happens on the site: confirming an address, a link
 * for a forgotten password (with the username), and notifications by mail for the kinds a member
 * chose, while they're away. Each in the reader's own language.
 */

const CONFIRM_HOURS = 48;
const RESET_HOURS = 1;

/**
 * The site's address for links in mails: PUBLIC_URL, or else the address an admin last opened the
 * Admin page at (rememberOrigin). Never just any visitor's: a made-up Host header would otherwise put
 * someone else's site in a password mail. Null when there's neither.
 */
export function mailOrigin(): string | null {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  return (db().prepare("select value from settings where key = 'mail.origin'").get() as { value: string } | undefined)?.value ?? null;
}

/** An admin's request (the Admin page, Admin → Mail): remember the address they use, for links in mails. */
export async function rememberOrigin() {
  if (process.env.PUBLIC_URL) return;
  try {
    db().prepare("insert into settings (key, value) values ('mail.origin', ?) on conflict(key) do update set value = excluded.value").run(await baseUrl());
  } catch {
    /* outside a request */
  }
}

// ───────────── not too many ─────────────

const g = globalThis as unknown as { __hdMailHits?: Map<string, number[]> };
const hits = (g.__hdMailHits ??= new Map<string, number[]>());

/** Counts one more for `key`: true when it's had `max` already in the last `windowMs` (and this one isn't counted). */
export function throttled(key: string, max: number, windowMs: number): boolean {
  const t = Date.now();
  const list = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
  if (list.length >= max) {
    hits.set(key, list);
    return true;
  }
  list.push(t);
  hits.set(key, list);
  return false;
}

// ───────────── the address ─────────────

/** The address waiting to be confirmed (the newest link still good), if any. */
export function pendingEmail(userId: number): string | null {
  const r = db().prepare("select email from mail_tokens where user_id = ? and used_at is null and expires_at > ? order by created_at desc limit 1").get(userId, now()) as { email: string } | undefined;
  return r?.email ?? null;
}

/** Someone else's confirmed address already? */
function takenByOther(email: string, userId: number): boolean {
  return !!db().prepare("select 1 from users where email = ? and id != ?").get(email, userId);
}

/**
 * Use this address: mails a link that confirms it (the confirmed one, if any, stays until then).
 * Throws a UserError for a bad address, one in use, or too many tries.
 */
export async function startConfirmation(u: Pick<User, "id" | "username" | "name">, raw: string): Promise<string> {
  if (!mailReady()) throw new UserError("This site can't send mail yet: an admin sets it up under Admin → Mail.");
  const email = normEmail(raw);
  if (!validEmail(email)) throw new UserError("That doesn't look like an email address.");
  if (takenByOther(email, u.id)) throw new UserError("Another account uses that address.");
  if (throttled(`confirm:${u.id}`, 5, 60 * 60_000)) throw new UserError("That's a lot of mails: wait a while and try again.");
  const token = randomToken(24);
  db().prepare("insert into mail_tokens (token, user_id, email, created_at, expires_at) values (?, ?, ?, ?, ?)").run(token, u.id, email, now(), now() + CONFIRM_HOURS * 3_600_000);
  // (their own link to their own address: the address they're using is fine when there's no other)
  const o = mailOrigin() ?? (await baseUrl());
  const site = getSettings().siteName;
  try {
    await sendMail(confirmMail(userT(u.id), { to: email, site, origin: o, name: u.name, username: u.username, link: `${o}/mail/confirm/${token}`, hours: CONFIRM_HOURS }), site);
  } catch {
    throw new UserError("The mail couldn't be sent. Try again later, or tell an admin.");
  }
  return email;
}

/** The link in the confirmation mail: the address becomes the account's. */
export function confirmEmail(token: string): { ok: true; userId: number; email: string } | { ok: false; error: string } {
  const r = db().prepare("select * from mail_tokens where token = ?").get(token) as { user_id: number; email: string; expires_at: number; used_at: number | null } | undefined;
  if (!r) return { ok: false, error: "This link doesn't work. Add the address again under Settings → Account to get a new one." };
  const user = db().prepare("select email from users where id = ?").get(r.user_id) as { email: string | null } | undefined;
  // a second click (or the mail program peeking first) is fine
  if (r.used_at && user?.email === r.email) return { ok: true, userId: r.user_id, email: r.email };
  if (r.used_at || r.expires_at < now()) return { ok: false, error: "This link has expired or been used. Add the address again under Settings → Account to get a new one." };
  if (takenByOther(r.email, r.user_id)) return { ok: false, error: "Another account confirmed that address first." };
  tx(() => {
    db().prepare("update users set email = ? where id = ?").run(r.email, r.user_id);
    db().prepare("update mail_tokens set used_at = ? where token = ?").run(now(), token);
    // older links for this account (other addresses) stop working
    db().prepare("delete from mail_tokens where user_id = ? and used_at is null").run(r.user_id);
  });
  audit(r.user_id, "email confirmed");
  return { ok: true, userId: r.user_id, email: r.email };
}

/** No address any more (and no link waiting): no mails at all. */
export function removeEmail(userId: number) {
  tx(() => {
    db().prepare("update users set email = null where id = ?").run(userId);
    db().prepare("delete from mail_tokens where user_id = ? and used_at is null").run(userId);
  });
}

// ───────────── a forgotten password ─────────────

/** Mail the username and a link for a new password (1 hour, once) to the account's confirmed address. */
async function sendRecovery(r: UserRow, o: string) {
  if (!r.email) throw new UserError("{name} has no confirmed email address.", { name: r.display_name });
  const token = randomToken(24);
  db().prepare("insert into resets (token, user_id, created_at, expires_at) values (?, ?, ?, ?)").run(token, r.id, now(), now() + RESET_HOURS * 3_600_000);
  const site = getSettings().siteName;
  await sendMail(recoveryMail(userT(r.id), { to: r.email, site, origin: o, name: r.display_name, username: r.username, link: `${o}/reset/${token}` }), site);
}

/**
 * The "Forgot your password?" page: a username or an address. Whether there's such an account (and
 * whether a mail went) isn't said, so the page can't be used to find out who's a member.
 */
export async function forgotPassword(who: string, ip: string) {
  const w = who.trim();
  if (!w || !mailReady()) return;
  if (throttled(`forgot-ip:${ip || "?"}`, 5, 15 * 60_000)) throw new UserError("Too many tries. Wait a quarter of an hour and try again.");
  const r = (w.includes("@") ? db().prepare("select * from users where email = ?").get(normEmail(w)) : db().prepare("select * from users where username = ?").get(w)) as UserRow | undefined;
  if (!r?.email || r.banned) return;
  if (throttled(`forgot-user:${r.id}`, 3, 60 * 60_000)) return;
  const o = mailOrigin();
  if (!o) {
    console.error("[mail] no reset mail: set PUBLIC_URL (or open the Admin page once) so links in mails have the site's address");
    return;
  }
  // not waited for: an answer that took longer for a real account would tell who has one
  void sendRecovery(r, o)
    .then(() => audit(r.id, "reset mail"))
    .catch(() => {
      /* kept under Admin → Mail (the last failure) */
    });
}

/** Admin → Members: mail someone a link for a new password. */
export async function mailResetLink(by: User, id: number) {
  if (!by.isAdmin) throw new UserError("Only admins can make reset links.");
  if (!mailReady()) throw new UserError("Set up mail under Admin → Mail first.");
  const r = db().prepare("select * from users where id = ?").get(id) as UserRow | undefined;
  if (!r) throw new UserError("No such member.");
  await rememberOrigin();
  try {
    await sendRecovery(r, mailOrigin() ?? (await baseUrl()));
  } catch (e) {
    if (e instanceof UserError) throw e;
    throw new UserError("The mail couldn't be sent: see Admin → Mail.");
  }
  audit(by.id, "reset mail", r.username);
  return r.email!;
}

// ───────────── notifications by mail ─────────────

/** The key in someone's "stop these mails" link (made the first time it's needed). */
function mailToken(userId: number): string {
  const r = db().prepare("select mail_token from users where id = ?").get(userId) as { mail_token: string | null } | undefined;
  if (r?.mail_token) return r.mail_token;
  const token = randomToken(18);
  db().prepare("update users set mail_token = ? where id = ?").run(token, userId);
  return token;
}

/**
 * A notification, by mail, if they chose that kind by mail, have a confirmed address and aren't on
 * the site (no tab open anywhere). One mail per conversation or kind in half an hour, and at most
 * eight an hour, so a busy chat doesn't fill an inbox. Never throws, never waits.
 */
export function mailNotification(u: User & { email: string | null }, n: { kind: NotifyKind; title: string; body: string; url: string; tag?: string }) {
  if (!u.email || !u.notify[n.kind]?.mail || connsOf(u.id).length || !mailReady()) return;
  // (from whoever caused it, so their address is no good for links in someone else's mail)
  const o = mailOrigin();
  if (!o) return;
  if (throttled(`note:${u.id}:${n.tag ?? n.kind}`, 1, 30 * 60_000) || throttled(`note:${u.id}`, 8, 60 * 60_000)) return;
  const to = u.email;
  void (async () => {
    const t = userT(u.id);
    const site = getSettings().siteName;
    const token = mailToken(u.id);
    await sendMail(
      notificationMail(t, {
        to,
        site,
        origin: o,
        title: n.title,
        body: n.body,
        link: `${o}${n.url}`,
        kind: t(NOTIFY_KINDS[n.kind]),
        settings: `${o}/settings/notifications`,
        unsubscribe: `${o}/mail/unsubscribe/${token}`,
        oneClick: `${o}/api/mail/unsubscribe/${token}`,
      }),
      site,
    );
  })().catch(() => {
    /* kept under Admin → Mail (the last failure) */
  });
}

/** The member behind a "stop these mails" link, and whether any notification mails are still on. */
export function unsubscribeUser(token: string): { id: number; name: string; email: string | null; on: boolean } | null {
  if (!token) return null;
  const r = db().prepare("select * from users where mail_token = ?").get(token) as UserRow | undefined;
  if (!r) return null;
  const u = toUser(r);
  return { id: u.id, name: u.name, email: r.email, on: (Object.keys(NOTIFY_KINDS) as NotifyKind[]).some((k) => u.notify[k].mail) };
}

/** Every notification mail off (the link), or back to the usual ones. */
export function setAllMail(token: string, on: boolean): boolean {
  const r = db().prepare("select * from users where mail_token = ?").get(token) as UserRow | undefined;
  if (!r) return false;
  const u = toUser(r);
  const next = { ...u.notify } as NotifyPrefs;
  for (const k of Object.keys(NOTIFY_KINDS) as NotifyKind[]) next[k] = { ...next[k], mail: on && MAIL_KINDS.includes(k) };
  const saved = (() => {
    try {
      return JSON.parse(r.notify_json || "{}") as Record<string, unknown>;
    } catch {
      return {};
    }
  })();
  db().prepare("update users set notify_json = ? where id = ?").run(JSON.stringify({ ...saved, ...next }), u.id);
  audit(u.id, on ? "notification mails on" : "notification mails off");
  return true;
}
