import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/lib/db";

/**
 * The server's own copies of its apps, put in the data folder's apps/ and downloaded from the site's
 * root by anyone (an app is installed before logging in):
 *
 * - the Android app, built with a name of its own (android/ -PappName): /friends-0.1.0.apk
 * - the desktop app, made a copy of its own by scripts/site-desktop.sh, one file per computer:
 *   /friends-desktop-0.1.0-linux-x86_64.AppImage, …-windows-x64-setup.exe, …-macos-arm64.zip
 *
 * The apps under their own name (Communarr) also come from GitHub, where the repo's workflows publish
 * them, unless the server has a copy of its own.
 */
export const APPS_DIR = path.join(DATA_DIR, "apps");
const APK = /^[A-Za-z0-9][\w.-]*\.apk$/;
export const DESKTOP_FILE = /^([a-z0-9][a-z0-9.-]*?)-desktop-(\d+(?:\.\d+)*)-(linux-x86_64\.AppImage|windows-x64-setup\.exe|macos-arm64\.zip)$/;

/** The computers the desktop app is built for, and how their files end. */
export const PLATFORMS = { "linux-x86_64": "linux-x86_64.AppImage", "windows-x64": "windows-x64-setup.exe", "macos-arm64": "macos-arm64.zip" } as const;
export type Platform = keyof typeof PLATFORMS;
const platformOf = (end: string) => (Object.keys(PLATFORMS) as Platform[]).find((p) => PLATFORMS[p] === end)!;

/** An app's newest version: Android's (platform null) or the desktop app's for one kind of computer. */
export interface AppRelease {
  /** the app's name in its files, lower case ("friends") */
  name: string;
  kind: "android" | "desktop";
  platform: Platform | null;
  version: string;
  /** where the site serves it (/friends-0.2.0.apk) */
  url: string;
  /** the desktop app's file's SHA-256, which it checks before putting it in (Check for updates gives it) */
  sha256?: string;
}

/** An app's file, or null (not a name an app can have, or no such file). */
export function appFile(name: string): string | null {
  if (!APK.test(name) && !DESKTOP_FILE.test(name)) return null;
  const file = path.join(APPS_DIR, name);
  try {
    return fs.statSync(file).isFile() ? file : null;
  } catch {
    return null;
  }
}

const version = (n: string) => (n.match(/-(\d+(?:\.\d+)*)(?:\.apk|-[a-z0-9_-]+\.\w+)$/)?.[1] ?? "").split(".").filter(Boolean).map(Number);
const compare = (a: number[], b: number[]) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  return 0;
};

/** The files there, newest first: the highest version in its name, else the one put there last. */
function files(): string[] {
  let names: string[];
  try {
    names = fs.readdirSync(APPS_DIR).filter((n) => APK.test(n) || DESKTOP_FILE.test(n));
  } catch {
    return [];
  }
  const time = (n: string) => fs.statSync(path.join(APPS_DIR, n)).mtimeMs;
  return names.sort((a, b) => compare(version(b), version(a)) || time(b) - time(a));
}

/** The Android app to link to (Download the app), or null when there's none. */
export function latestApp(): string | null {
  return files().find((f) => APK.test(f)) ?? null;
}

/**
 * The desktop app to link to for each computer (Download the app): the server's own newest copy, else
 * Communarr's newest on GitHub (through the site, as for updates), else GitHub's releases.
 */
export function desktopDownloads(): Record<Platform, string> {
  const local = files().filter((f) => DESKTOP_FILE.test(f));
  const gh = githubApp().desktop;
  const out = {} as Record<Platform, string>;
  for (const p of Object.keys(PLATFORMS) as Platform[]) {
    const f = local.find((x) => x.endsWith(`-${PLATFORMS[p]}`));
    out[p] = f ? `/${f}` : gh[p] ? `/${GENERIC}-desktop-${gh[p]!.version}-${PLATFORMS[p]}` : `https://github.com/${REPO}/releases`;
  }
  return out;
}

/**
 * Each app's newest version, by its name (the file's, before its version: "friends" for
 * friends-0.2.0.apk) and kind (and the desktop app's computer): what an app compares itself with, to
 * offer an update. The apps under their own name (Communarr) also from GitHub, unless the server has a
 * copy of them.
 */
export function latestApps(): AppRelease[] {
  const out = new Map<string, AppRelease>();
  for (const f of files()) {
    const a = f.match(/^(.+)-(\d+(?:\.\d+)*)\.apk$/);
    const d = f.match(DESKTOP_FILE);
    const r: AppRelease | null = a
      ? { name: a[1].toLowerCase(), kind: "android", platform: null, version: a[2], url: `/${f}` }
      : d
        ? { name: d[1], kind: "desktop", platform: platformOf(d[3]), version: d[2], url: `/${f}` }
        : null;
    const key = r && `${r.name}|${r.kind}|${r.platform}`;
    if (r && !out.has(key!)) out.set(key!, r);
  }
  const gh = githubApp();
  if (gh.android && !out.has(`${GENERIC}|android|null`)) out.set(`${GENERIC}|android|null`, { name: GENERIC, kind: "android", platform: null, version: gh.android.version, url: `/${GENERIC}-${gh.android.version}.apk` });
  for (const p of Object.keys(PLATFORMS) as Platform[]) {
    const r = gh.desktop[p];
    if (r && !out.has(`${GENERIC}|desktop|${p}`)) out.set(`${GENERIC}|desktop|${p}`, { name: GENERIC, kind: "desktop", platform: p, version: r.version, url: `/${GENERIC}-desktop-${r.version}-${PLATFORMS[p]}`, sha256: r.sha256 });
  }
  return [...out.values()];
}

/** The same, with the server's own desktop files' SHA-256 (worked out once per file). */
export async function latestAppsChecked(): Promise<AppRelease[]> {
  return Promise.all(latestApps().map(async (a) => (a.kind === "desktop" && !a.sha256 ? { ...a, sha256: (await sha256(a.url.slice(1))) ?? undefined } : a)));
}

const hashes = ((globalThis as typeof globalThis & { __hdAppHashes?: Map<string, { key: string; hash: Promise<string | null> }> }).__hdAppHashes ??= new Map());

function sha256(name: string): Promise<string | null> {
  const file = appFile(name);
  if (!file) return Promise.resolve(null);
  const st = fs.statSync(file);
  const key = `${st.size}|${st.mtimeMs}`;
  const known = hashes.get(name);
  if (known?.key === key) return known.hash;
  const hash = new Promise<string | null>((resolve) => {
    const h = crypto.createHash("sha256");
    fs.createReadStream(file)
      .on("data", (c) => h.update(c))
      .on("end", () => resolve(h.digest("hex")))
      .on("error", () => resolve(null));
  });
  hashes.set(name, { key, hash });
  return hash;
}

/**
 * The apps under their own name, as the repo's workflows publish them: the highest android-v* release
 * on GitHub with its APK, and the highest desktop-v* with each computer's file. GitHub is asked at most
 * once an hour (ten minutes after it couldn't be reached); Check for updates asks now, at most once a
 * minute. They're offered from the site (/communarr-0.2.0.apk, /communarr-desktop-0.2.0-…, which lead
 * on to GitHub's file), as the apps only update from their server.
 */
export const GENERIC = "communarr";
const REPO = process.env.APP_REPO || "svennefenne/communarr";
const ANDROID_FILE = "communarr-android.apk";
type Release = { version: string; url: string; sha256?: string };
type Releases = { android: Release | null; desktop: Partial<Record<Platform, Release>> };
const cache = ((globalThis as typeof globalThis & { __hdAppRelease?: { latest: Releases; ok: boolean; next: number; asked: number; pending: Promise<void> | null } }).__hdAppRelease ??= {
  latest: { android: null, desktop: {} },
  ok: false,
  next: 0,
  asked: 0,
  pending: null,
});
// (a server that ran an older version of this file kept the Android app's release alone)
if (!cache.latest || !("desktop" in cache.latest)) cache.latest = { android: null, desktop: {} };
const nums = (v: string) => v.split(".").map(Number);

async function askGithub(): Promise<void> {
  cache.asked = Date.now();
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=50`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "Communarr" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) throw new Error(`GitHub answered ${r.status}`);
    const latest: Releases = { android: null, desktop: {} };
    const better = (was: Release | null | undefined, v: string) => !was || compare(nums(v), nums(was.version)) > 0;
    for (const rel of (await r.json()) as { tag_name?: string; draft?: boolean; prerelease?: boolean; assets?: { name: string; browser_download_url: string; digest?: string | null }[] }[]) {
      if (rel.draft || rel.prerelease) continue;
      const a = rel.tag_name?.match(/^android-v(\d+(?:\.\d+)*)$/);
      const apk = rel.assets?.find((x) => x.name === ANDROID_FILE);
      if (a && apk && better(latest.android, a[1])) latest.android = { version: a[1], url: apk.browser_download_url };
      const d = rel.tag_name?.match(/^desktop-v(\d+(?:\.\d+)*)$/);
      if (!d) continue;
      for (const p of Object.keys(PLATFORMS) as Platform[]) {
        const f = rel.assets?.find((x) => x.name === `${GENERIC}-desktop-${PLATFORMS[p]}`);
        const sha = f?.digest?.match(/^sha256:([a-f0-9]{64})$/)?.[1];
        if (f && sha && better(latest.desktop[p], d[1])) latest.desktop[p] = { version: d[1], url: f.browser_download_url, sha256: sha };
      }
    }
    cache.latest = latest;
    cache.ok = true;
    cache.next = Date.now() + 3600_000;
  } catch (e) {
    console.warn(`[apps] couldn't ask GitHub for the apps' newest versions: ${e instanceof Error ? e.message : e}`);
    cache.ok = false;
    cache.next = Date.now() + 600_000;
  }
}

/** GitHub's newest releases of the apps as last heard (asked again in the background when it's time). */
export function githubApp(): Releases {
  if (Date.now() >= cache.next && !cache.pending) cache.pending = askGithub().finally(() => (cache.pending = null));
  return cache.latest;
}

/** The same, asked now (or the answer from under a minute ago): false when GitHub couldn't be reached. */
export async function githubAppNow(): Promise<Releases | false> {
  if (!cache.pending && Date.now() - cache.asked >= 60_000) cache.pending = askGithub().finally(() => (cache.pending = null));
  await cache.pending;
  return cache.ok ? cache.latest : false;
}

/** Where a name the site serves leads on GitHub (/communarr-0.2.0.apk, /communarr-desktop-0.2.0-…), or null. */
export function githubFile(name: string): string | null {
  const gh = githubApp();
  if (gh.android && name === `${GENERIC}-${gh.android.version}.apk`) return gh.android.url;
  const d = name.match(DESKTOP_FILE);
  if (d && d[1] === GENERIC) {
    const r = gh.desktop[platformOf(d[3])];
    if (r && r.version === d[2]) return r.url;
  }
  return null;
}
