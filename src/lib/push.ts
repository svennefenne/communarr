import "server-only";
import webpush from "web-push";
import { db, now } from "./db";
import { getMeta, getSettings, setMeta } from "./settings";

/**
 * Web Push: notifications on phones, tablets and computers, even with the site closed. The VAPID
 * key pair is made once and kept in the database. Phones need the site served over HTTPS, and an
 * iPhone or iPad needs it added to the home screen first (iOS 16.4+).
 */

interface Keys {
  publicKey: string;
  privateKey: string;
}

function keys(): Keys {
  const stored = getMeta("vapid");
  if (stored) {
    try {
      return JSON.parse(stored) as Keys;
    } catch {
      /* make new ones */
    }
  }
  const k = webpush.generateVAPIDKeys();
  setMeta("vapid", JSON.stringify(k));
  return k;
}

export function vapidPublicKey(): string {
  return keys().publicKey;
}

/** Make new keys: every device has to subscribe again. */
export function rotateVapid() {
  setMeta("vapid", JSON.stringify(webpush.generateVAPIDKeys()));
  db().prepare("delete from push_subs").run();
}

function subject() {
  const s = getSettings().pushContact.trim();
  if (/^(mailto:|https:\/\/)/.test(s)) return s;
  const pub = process.env.PUBLIC_URL || "";
  return pub.startsWith("https://") ? pub : "https://github.com/svennefenne/communarr";
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  /** the number for the app icon's badge */
  badge?: number;
}

interface SubRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  fails: number;
}

/** The browsers' push services (Chrome/Android, Firefox, Safari/iOS, Edge); PUSH_HOSTS adds more. */
const PUSH_HOSTS = ["fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com", ...(process.env.PUSH_HOSTS || "").split(",").map((s) => s.trim()).filter(Boolean)];

export function isPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && !u.username && !u.port && PUSH_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export function saveSubscription(userId: number, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, ua: string) {
  db()
    .prepare(
      `insert into push_subs (user_id, endpoint, p256dh, auth, user_agent, created_at) values (?, ?, ?, ?, ?, ?)
       on conflict(endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent, fails = 0`,
    )
    .run(userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, ua.slice(0, 300), now());
}

export function removeSubscription(userId: number, endpoint: string) {
  db().prepare("delete from push_subs where user_id = ? and endpoint = ?").run(userId, endpoint);
}

export function devices(userId: number) {
  return db().prepare("select id, endpoint, user_agent ua, created_at createdAt, last_ok_at lastOk from push_subs where user_id = ? order by created_at desc").all(userId) as {
    id: number;
    endpoint: string;
    ua: string;
    createdAt: number;
    lastOk: number | null;
  }[];
}

export async function pushTo(userId: number, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const subs = db().prepare("select id, endpoint, p256dh, auth, fails from push_subs where user_id = ?").all(userId) as SubRow[];
  if (!subs.length) return { sent: 0, failed: 0 };
  const k = keys();
  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          vapidDetails: { subject: subject(), publicKey: k.publicKey, privateKey: k.privateKey },
          TTL: 60 * 60 * 24,
          urgency: "high",
          topic: payload.tag?.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined,
        });
        sent++;
        db().prepare("update push_subs set last_ok_at = ?, fails = 0 where id = ?").run(now(), s.id);
      } catch (e) {
        failed++;
        const code = (e as { statusCode?: number }).statusCode;
        // gone for good (unsubscribed, app removed): forget it; otherwise give up after a few tries
        if (code === 404 || code === 410 || s.fails >= 9) db().prepare("delete from push_subs where id = ?").run(s.id);
        else db().prepare("update push_subs set fails = fails + 1 where id = ?").run(s.id);
      }
    }),
  );
  return { sent, failed };
}
