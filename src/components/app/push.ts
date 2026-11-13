"use client";

/** Push notifications on this device: register the service worker, ask, subscribe, unsubscribe. */

import { inDesktopApp } from "./androidApp";

export type PushState = "unsupported" | "insecure" | "needs-install" | "denied" | "off" | "on";

/**
 * How turning push on went: its state now, and if it's still off, why: the browser's question was
 * closed without an answer (dismissed), or something failed on the way (error: what).
 */
export interface PushResult {
  state: PushState;
  why?: "dismissed" | "failed";
  error?: string;
}

function urlB64ToUint8Array(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
  } catch {
    return null;
  }
}

export async function pushState(): Promise<PushState> {
  // the desktop app has no push service (Electron): its notifications come down the live stream instead
  if (inDesktopApp()) return "unsupported";
  if (!window.isSecureContext) return "insecure";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return ios && !standalone ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

export async function enablePush(): Promise<PushResult> {
  try {
    return await subscribe();
  } catch (e) {
    // (e.g. a browser without a push service: "Registration failed - push service error")
    return { state: "off", why: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}

async function subscribe(): Promise<PushResult> {
  const perm = await Notification.requestPermission();
  if (perm === "denied") return { state: "denied" };
  if (perm !== "granted") return { state: "off", why: "dismissed" };
  const reg = await registration();
  if (!reg) return { state: "off", why: "failed", error: "the service worker didn't start" };
  await navigator.serviceWorker.ready;
  const keyRes = await fetch("/api/push");
  if (!keyRes.ok) return { state: "off", why: "failed", error: `the server answered ${keyRes.status}` };
  const { key } = (await keyRes.json()) as { key: string };
  let sub = await reg.pushManager.getSubscription();
  // subscribed with an older key (the admin made new ones): start over
  if (sub && sub.options.applicationServerKey) {
    const cur = new Uint8Array(sub.options.applicationServerKey);
    const want = urlB64ToUint8Array(key);
    if (cur.length !== want.length || cur.some((v, i) => v !== want[i])) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(key) });
  const res = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
  if (res.ok) return { state: "on" };
  const d = (await res.json().catch(() => ({}))) as { error?: string };
  // (not kept here either: a subscription the server doesn't have would look like "on")
  await sub.unsubscribe().catch(() => {});
  return { state: "off", why: "failed", error: d.error || `the server answered ${res.status}` };
}

export async function disablePush(): Promise<PushState> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
    await sub.unsubscribe();
  }
  return "off";
}

export async function testPush(): Promise<{ sent: number; failed: number }> {
  const res = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ test: true }) });
  return res.json();
}
