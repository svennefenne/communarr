import "server-only";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, now } from "./db";
import { toUser, type User, type UserRow } from "./users";

export const SESSION_COOKIE = "hd_session";
const SESSION_DAYS = 90;

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64");
  const got = await scrypt(pw, Buffer.from(salt, "base64"), want.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString("base64url");

/** Behind a TLS proxy the cookie is marked Secure. */
async function secureRequest(): Promise<boolean> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return (process.env.PUBLIC_URL || "").startsWith("https://");
}

export async function clientInfo() {
  const h = await headers();
  return {
    ua: (h.get("user-agent") || "").slice(0, 300),
    ip: (h.get("cf-connecting-ip") || h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0] || "").trim(),
  };
}

export async function startSession(userId: number) {
  const token = randomToken(32);
  const { ua, ip } = await clientInfo();
  const t = now();
  db()
    .prepare("insert into sessions (id, user_id, created_at, last_used, expires_at, user_agent, ip) values (?, ?, ?, ?, ?, ?, ?)")
    .run(sha(token), userId, t, t, t + SESSION_DAYS * 86_400_000, ua, ip);
  db().prepare("update users set last_seen = ? where id = ?").run(t, userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await secureRequest(),
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) db().prepare("delete from sessions where id = ?").run(sha(token));
  jar.delete(SESSION_COOKIE);
}

export async function currentSessionId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? sha(token) : null;
}

/** Who is signed in (once per request). Banned, suspended and unapproved accounts count as signed out. */
export const getUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return userForToken(token);
});

export function userForToken(token: string): User | null {
  const id = sha(token);
  const row = db()
    .prepare("select u.*, s.last_used s_used, s.expires_at s_exp from sessions s join users u on u.id = s.user_id where s.id = ?")
    .get(id) as (UserRow & { s_used: number; s_exp: number }) | undefined;
  if (!row) return null;
  const t = now();
  if (row.s_exp < t) {
    db().prepare("delete from sessions where id = ?").run(id);
    return null;
  }
  const user = toUser(row);
  if (user.banned || (user.suspendedUntil && user.suspendedUntil > t)) return null;
  // touch the session now and then (not on every request)
  if (t - row.s_used > 5 * 60_000) {
    db().prepare("update sessions set last_used = ?, expires_at = ? where id = ?").run(t, t + SESSION_DAYS * 86_400_000, id);
    db().prepare("update users set last_seen = ? where id = ?").run(t, user.id);
  }
  return user;
}

export async function requireUser(): Promise<User> {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireMod(): Promise<User> {
  const u = await requireUser();
  if (!u.isMod) redirect("/");
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (!u.isAdmin) redirect("/");
  return u;
}

export function hasAnyUser(): boolean {
  return !!db().prepare("select 1 from users limit 1").get();
}

// ── log-in attempts: at most 8 failures per name and address in 10 minutes ──
const g = globalThis as typeof globalThis & { __hdAttempts?: Map<string, number[]> };
const attempts = (g.__hdAttempts ??= new Map());

export function tooManyAttempts(key: string): boolean {
  const list = (attempts.get(key) || []).filter((t: number) => t > Date.now() - 10 * 60_000);
  attempts.set(key, list);
  return list.length >= 8;
}
export function noteFailure(key: string) {
  const list = attempts.get(key) || [];
  list.push(Date.now());
  attempts.set(key, list);
}
export function clearFailures(key: string) {
  attempts.delete(key);
}

export function audit(actorId: number | null, action: string, target = "", detail = "") {
  db().prepare("insert into audit_log (actor_id, action, target, detail, created_at) values (?, ?, ?, ?, ?)").run(actorId, action, target, detail, now());
}
