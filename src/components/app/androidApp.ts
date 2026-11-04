"use client";

/**
 * The Android app (android/) as the page sees it: its name and version, which it says in its user
 * agent ("CommunarrApp/0.1.0 (Communarr)"), and messages to it through its bridge (window.CommunarrApp,
 * there only on the server's own pages in the app).
 */
export interface AppInfo {
  name: string;
  version: string;
}

export function appInfo(): AppInfo | null {
  if (typeof navigator === "undefined") return null;
  const m = navigator.userAgent.match(/CommunarrApp\/([\d.]+)(?: \(([^)]+)\))?/);
  return m ? { version: m[1], name: m[2] ?? "Communarr" } : null;
}

/** In the Android app. */
export const inApp = () => appInfo() !== null;

function newer(a: string, b: string): boolean {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

/** A newer version of this app on the server (the data folder's apps/, by the app's name), or null. */
export function appUpdate(apps: { name: string; version: string; url: string }[], info = appInfo()) {
  if (!info) return null;
  const a = apps.find((x) => x.name === info.name.toLowerCase());
  return a && newer(a.version, info.version) ? a : null;
}

interface Bridge {
  postMessage(m: string): void;
  addEventListener(type: "message", fn: (e: { data: string }) => void): void;
  removeEventListener(type: "message", fn: (e: { data: string }) => void): void;
}
const bridge = () => (typeof window === "undefined" ? undefined : (window as unknown as { CommunarrApp?: Bridge }).CommunarrApp);

/** Tell the app something ({t: "update", url}); false outside the app. */
export function tellApp(msg: { t: string } & Record<string, unknown>): boolean {
  const b = bridge();
  b?.postMessage(JSON.stringify(msg));
  return !!b;
}

/**
 * Ask the app something and wait for its answer (of the kind `answer`, else the same t as the
 * question), or null: not in the app, or no answer in time.
 */
export function askApp<T>(msg: { t: string } & Record<string, unknown>, ms = 5000, answer = msg.t): Promise<T | null> {
  const b = bridge();
  if (!b) return Promise.resolve(null);
  return new Promise((resolve) => {
    const done = (v: T | null) => {
      b.removeEventListener("message", on);
      clearTimeout(timer);
      resolve(v);
    };
    const on = (e: { data: string }) => {
      try {
        const d = JSON.parse(e.data) as { t?: string };
        if (d.t === answer) done(d as T);
      } catch {
        /* not one of ours */
      }
    };
    const timer = setTimeout(() => done(null), ms);
    b.addEventListener("message", on);
    b.postMessage(JSON.stringify(msg));
  });
}
