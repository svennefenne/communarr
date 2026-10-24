import "server-only";
import nodemailer from "nodemailer";
import { db } from "./db";

/**
 * Sending mail: confirming a member's address, the "forgot your password" link, and notifications
 * for the ones who want them by mail. Through an SMTP server: the one set under Admin → Mail, or
 * else the SMTP_* environment variables (docker-compose.yml). With neither there's no mail: password
 * resets are links an admin makes, as before.
 *
 * The settings (with the password) live in the settings table under their own keys, which
 * getSettings() leaves out, so they never reach a browser.
 */

export type MailSecurity = "tls" | "starttls" | "none";

export interface MailSettings {
  host: string;
  port: number;
  /** tls: encrypted from the start (usually port 465); starttls: upgraded after connecting (587); none: plain (25, a local relay) */
  security: MailSecurity;
  user: string;
  pass: string;
  /** the sender's address, e.g. noreply@example.com (with Gmail: the Gmail address itself) */
  from: string;
  /** the sender's name in the inbox (empty: the site's name) */
  fromName: string;
}

const KEY = "mail.smtp";
const FAIL_KEY = "mail.lastError";

function kvGet(key: string): string | null {
  return (db().prepare("select value from settings where key = ?").get(key) as { value: string } | undefined)?.value ?? null;
}
function kvSet(key: string, value: string) {
  db().prepare("insert into settings (key, value) values (?, ?) on conflict(key) do update set value = excluded.value").run(key, value);
}

const envSettings = (): MailSettings | null => {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;
  const security = (process.env.SMTP_SECURE ?? "").toLowerCase();
  const port = Number(process.env.SMTP_PORT) || (security === "tls" || security === "true" ? 465 : security === "none" || security === "false" ? 25 : 587);
  return {
    host,
    port,
    security: security === "tls" || security === "true" ? "tls" : security === "none" || security === "false" ? "none" : port === 465 ? "tls" : "starttls",
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "",
    fromName: process.env.SMTP_FROM_NAME || "",
  };
};

const saved = (): MailSettings | null => {
  try {
    const s = JSON.parse(kvGet(KEY) || "null") as MailSettings | null;
    return s?.host ? s : null;
  } catch {
    return null;
  }
};

/** The settings in use, and where they come from. */
export function getMailSettings(): { settings: MailSettings | null; source: "admin" | "env" | null } {
  const a = saved();
  if (a) return { settings: a, source: "admin" };
  const e = envSettings();
  return e ? { settings: e, source: "env" } : { settings: null, source: null };
}

/** Is there a mail server to send through? */
export const mailReady = () => {
  const s = getMailSettings().settings;
  return !!s && !!s.host && !!s.from;
};

/** Save Admin → Mail (an empty password keeps the saved one; an empty server turns mail off, back to SMTP_* if set). */
export function saveMailSettings(next: Omit<MailSettings, "pass"> & { pass: string | null }) {
  if (!next.host) {
    db().prepare("delete from settings where key = ?").run(KEY);
    return;
  }
  const pass = next.pass === null ? (saved()?.pass ?? "") : next.pass;
  kvSet(KEY, JSON.stringify({ ...next, pass } satisfies MailSettings));
}

const server = (s: MailSettings) => ({
  host: s.host,
  port: s.port,
  secure: s.security === "tls",
  requireTLS: s.security === "starttls",
  ignoreTLS: s.security === "none",
  auth: s.user ? { user: s.user, pass: s.pass } : undefined,
  connectionTimeout: 15_000,
  greetingTimeout: 15_000,
  socketTimeout: 30_000,
});

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** extra headers (List-Unsubscribe on notification mails) */
  headers?: Record<string, string>;
}

/** The last mail that couldn't be sent, for Admin → Mail. */
export interface MailFailure {
  at: number;
  to: string;
  error: string;
}

export function lastMailFailure(): MailFailure | null {
  try {
    return JSON.parse(kvGet(FAIL_KEY) || "null") as MailFailure | null;
  } catch {
    return null;
  }
}

/** Send a mail (throws with the server's reason when it can't; the failure is kept for Admin → Mail). */
export async function sendMail(mail: Mail, siteName: string, settings = getMailSettings().settings): Promise<void> {
  if (!settings) throw new Error("No mail server is set up.");
  try {
    await nodemailer.createTransport(server(settings)).sendMail({
      from: { name: settings.fromName || siteName, address: settings.from },
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      headers: mail.headers,
    });
  } catch (e) {
    const error = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    console.error(`[mail] to ${mail.to}: ${error}`);
    kvSet(FAIL_KEY, JSON.stringify({ at: Date.now(), to: mail.to, error } satisfies MailFailure));
    throw e;
  }
}

/** a•••@example.com: enough to recognise your own address, not enough to learn someone else's */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, Math.min(2, Math.max(1, name.length - 2)))}•••@${domain}`;
}

/** A plausible address: something@something.tld, at most 254 characters, nothing that could make it two (spaces, commas, brackets, quotes). */
export const validEmail = (email: string) => email.length <= 254 && /^[^\s@,;:<>()\[\]"\\]+@[^\s@,;:<>()\[\]"\\]+\.[^\s@,;:<>()\[\]"\\]{2,}$/.test(email);

/** The same address however it was typed. */
export const normEmail = (email: string) => email.trim().toLowerCase();
