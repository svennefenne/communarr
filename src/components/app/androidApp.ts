"use client";

/**
 * The apps as the page sees them: the Android app (android/) and the desktop app (desktop/). Each says
 * its name and version in its user agent ("CommunarrApp/0.1.0 (Friends)", "CommunarrDesktop/0.1.0
 * (Friends; linux-x86_64)"), and takes messages through the same bridge (window.CommunarrApp, there only
 * on the server's own pages in the app).
 */
export interface AppInfo {
  name: string;
  version: string;
  kind: "android" | "desktop";
  /** the desktop app's kind of computer ("linux-x86_64", "windows-x64", "macos-arm64") */
  platform: string | null;
}

export function appInfo(): AppInfo | null {
  if (typeof navigator === "undefined") return null;
  const d = navigator.userAgent.match(/CommunarrDesktop\/([\d.]+) \(([^;)]+); ([\w-]+)\)/);
  if (d) return { version: d[1], name: d[2], kind: "desktop", platform: d[3] };
  const m = navigator.userAgent.match(/CommunarrApp\/([\d.]+)(?: \(([^)]+)\))?/);
  return m ? { version: m[1], name: m[2] ?? "Communarr", kind: "android", platform: null } : null;
}

/** In one of the apps. */
export const inApp = () => appInfo() !== null;
/** In the Android app. */
export const inAndroidApp = () => appInfo()?.kind === "android";
/** In the desktop app. */
export const inDesktopApp = () => appInfo()?.kind === "desktop";

/** An app's name as its files have it ("friends"; desktop/src/site.ts's slug). */
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "app";

function newer(a: string, b: string): boolean {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

type Release = { name: string; kind: "android" | "desktop"; platform: string | null; version: string; url: string; sha256?: string };

/** A newer version of this app on the server (by the app's name and kind, and the desktop app's computer), or null. */
export function appUpdate(apps: Release[], info = appInfo()): Release | null {
  if (!info) return null;
  const a = apps.find((x) => x.name === slug(info.name) && x.kind === info.kind && (info.kind === "android" || x.platform === info.platform));
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

/** The app's own messages to the page ({t: "open", url}, {t: "idle", idle}): a function that stops listening. */
export function onAppMessage(fn: (m: { t?: string } & Record<string, unknown>) => void): () => void {
  const b = bridge();
  if (!b) return () => {};
  const on = (e: { data: string }) => {
    let m: unknown;
    try {
      m = JSON.parse(e.data);
    } catch {
      return;
    }
    if (m && typeof m === "object") fn(m as { t?: string } & Record<string, unknown>);
  };
  b.addEventListener("message", on);
  return () => b.removeEventListener("message", on);
}
