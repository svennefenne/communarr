import "server-only";
import crypto from "node:crypto";
import { db, now } from "./db";
import { getMeta, setMeta } from "./settings";
import type { PushPayload } from "./push";

/**
 * Notifications in the Android app (android/), through Firebase Cloud Messaging: a web view gets no
 * web push. Admin → Notifications takes the Firebase project's google-services.json (each app's
 * settings, which the app asks for after logging in) and a service account's key (to send with; it
 * stays on the server). A phone's token lasts as long as the session it logged in with.
 */

interface Services {
  project_info?: { project_number?: string; project_id?: string };
  client?: { client_info?: { mobilesdk_app_id?: string; android_client_info?: { package_name?: string } }; api_key?: { current_key?: string }[] }[];
}
interface Account {
  type?: string;
  project_id?: string;
  private_key?: string;
  client_email?: string;
  token_uri?: string;
}

/** What the app starts Firebase with. */
export interface AppPushOptions {
  apiKey: string;
  appId: string;
  projectId: string;
  senderId: string;
}

function read<T>(key: string): T | null {
  const v = getMeta(key);
  if (!v) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

const packages = (s: Services | null) => (s?.client ?? []).map((c) => c.client_info?.android_client_info?.package_name ?? "").filter(Boolean);

/** One app's Firebase settings (by its package), or null: not set up, or that app isn't in the project. */
export function appPushOptions(pkg: string): AppPushOptions | null {
  const s = read<Services>("fcm.services");
  const c = s?.client?.find((x) => x.client_info?.android_client_info?.package_name === pkg);
  const o = { apiKey: c?.api_key?.[0]?.current_key ?? "", appId: c?.client_info?.mobilesdk_app_id ?? "", projectId: s?.project_info?.project_id ?? "", senderId: s?.project_info?.project_number ?? "" };
  return o.apiKey && o.appId && o.projectId && o.senderId && read<Account>("fcm.account") ? o : null;
}

/** For Admin: the project, the apps in it and the account that sends (never its key). */
export function fcmStatus(): { project: string | null; apps: string[]; account: string | null; phones: number } {
  const s = read<Services>("fcm.services");
  const a = read<Account>("fcm.account");
  const phones = (db().prepare("select count(*) n from app_push").get() as { n: number }).n;
  return { project: s?.project_info?.project_id ?? null, apps: packages(s), account: a?.client_email ?? null, phones };
}

/** Admin: the google-services.json and/or the service account's key (JSON). Returns what's wrong, or null. */
export function setFcm(o: { services?: string; account?: string }): string | null {
  let services = read<Services>("fcm.services");
  let account = read<Account>("fcm.account");
  if (o.services?.trim()) {
    try {
      services = JSON.parse(o.services) as Services;
    } catch {
      return "That google-services.json isn't JSON.";
    }
    if (!services?.project_info?.project_id || !packages(services).length) return "That isn't a google-services.json with an Android app in it.";
  }
  if (o.account?.trim()) {
    try {
      account = JSON.parse(o.account) as Account;
    } catch {
      return "That key isn't JSON.";
    }
    if (account?.type !== "service_account" || !account.private_key?.includes("PRIVATE KEY") || !account.client_email || !account.project_id) return "That isn't a service account's key (Project settings → Service accounts → Generate new private key).";
  }
  if (services && account && services.project_info?.project_id !== account.project_id) return "The key is for another Firebase project than the google-services.json.";
  if (o.services?.trim()) setMeta("fcm.services", JSON.stringify(services));
  if (o.account?.trim()) setMeta("fcm.account", JSON.stringify(account));
  cached = null;
  return null;
}

export function clearFcm() {
  db().prepare("delete from meta where key in ('fcm.services', 'fcm.account')").run();
  db().prepare("delete from app_push").run();
  cached = null;
}

/** A phone's token, for the session it's logged in with (a token moves with whoever logs in on it). */
export function saveAppToken(userId: number, sessionId: string, token: string, app: string) {
  db()
    .prepare(
      `insert into app_push (token, user_id, session_id, app, created_at) values (?, ?, ?, ?, ?)
       on conflict(token) do update set user_id = excluded.user_id, session_id = excluded.session_id, app = excluded.app, fails = 0`,
    )
    .run(token.slice(0, 4096), userId, sessionId, app.slice(0, 100), now());
}

/** Someone's phones with the app (Settings → Notifications). */
export function appDevices(userId: number) {
  return db()
    .prepare("select ap.rowid id, ap.app, ap.created_at createdAt, ap.last_ok_at lastOk from app_push ap join sessions s on s.id = ap.session_id where ap.user_id = ? and s.expires_at > ? order by ap.created_at desc")
    .all(userId, now()) as { id: number; app: string; createdAt: number; lastOk: number | null }[];
}

// an access token to send with, from the service account's key (a signed JWT), kept for its hour
let cached: { token: string; until: number } | null = null;

async function accessToken(a: Account): Promise<string> {
  if (cached && cached.until > Date.now()) return cached.token;
  const url = a.token_uri || "https://oauth2.googleapis.com/token";
  const t = Math.floor(Date.now() / 1000);
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${part({ alg: "RS256", typ: "JWT" })}.${part({ iss: a.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: url, iat: t, exp: t + 3600 })}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(a.private_key!).toString("base64url");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!res.ok || !j.access_token) throw new Error(`Firebase sign-in failed (${res.status})`);
  cached = { token: j.access_token, until: Date.now() + ((j.expires_in ?? 3600) - 120) * 1000 };
  return j.access_token;
}

/** The push to someone's phones with the app (as a data message: the app shows it, and opens its url). */
export async function pushToApps(userId: number, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const account = read<Account>("fcm.account");
  if (!account?.private_key) return { sent: 0, failed: 0 };
  const rows = db().prepare("select ap.token, ap.fails from app_push ap join sessions s on s.id = ap.session_id where ap.user_id = ? and s.expires_at > ?").all(userId, now()) as { token: string; fails: number }[];
  if (!rows.length) return { sent: 0, failed: 0 };
  let token: string;
  try {
    token = await accessToken(account);
  } catch {
    return { sent: 0, failed: rows.length };
  }
  let sent = 0;
  let failed = 0;
  await Promise.all(
    rows.map(async (r) => {
      const tag = payload.tag?.slice(0, 64) || "";
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: {
            token: r.token,
            data: { title: payload.title, body: payload.body, url: payload.url, tag, badge: payload.badge ? String(payload.badge) : "" },
            // high: through to a phone that's asleep, as a chat message has to be
            android: { priority: "HIGH", ttl: "86400s", ...(tag ? { collapse_key: tag } : {}) },
          },
        }),
      }).catch(() => null);
      if (res?.ok) {
        sent++;
        db().prepare("update app_push set last_ok_at = ?, fails = 0 where token = ?").run(now(), r.token);
        return;
      }
      failed++;
      const err = res ? ((await res.json().catch(() => ({}))) as { error?: { status?: string; details?: { errorCode?: string }[] } }).error : undefined;
      const code = err?.details?.find((d) => d.errorCode)?.errorCode ?? err?.status;
      // the app's gone from the phone (or the token's no good): forget it; otherwise give up after a few tries
      if (res?.status === 404 || code === "UNREGISTERED" || code === "INVALID_ARGUMENT" || r.fails >= 9) db().prepare("delete from app_push where token = ?").run(r.token);
      else db().prepare("update app_push set fails = fails + 1 where token = ?").run(r.token);
    }),
  );
  return { sent, failed };
}
