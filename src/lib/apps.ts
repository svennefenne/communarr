import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/lib/db";

/**
 * The server's own copies of the Android app (built with a name of their own, android/ -PappName):
 * .apk files put in the data folder's apps/, downloaded from the site's root (/friends-0.1.0.apk) by
 * anyone, as the app is installed before logging in.
 */
export const APPS_DIR = path.join(DATA_DIR, "apps");
export const APP_NAME = /^[A-Za-z0-9][\w.-]*\.apk$/;

/** An app's file, or null (not a name an app can have, or no such file). */
export function appFile(name: string): string | null {
  if (!APP_NAME.test(name)) return null;
  const file = path.join(APPS_DIR, name);
  try {
    return fs.statSync(file).isFile() ? file : null;
  } catch {
    return null;
  }
}

const version = (n: string) => (n.match(/-(\d+(?:\.\d+)*)\.apk$/)?.[1] ?? "").split(".").filter(Boolean).map(Number);
const compare = (a: number[], b: number[]) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  return 0;
};

/** The apps there, newest first: the highest version in its name (friends-0.2.0.apk), else the one put there last. */
function apps(): string[] {
  let names: string[];
  try {
    names = fs.readdirSync(APPS_DIR).filter((n) => APP_NAME.test(n));
  } catch {
    return [];
  }
  const time = (n: string) => fs.statSync(path.join(APPS_DIR, n)).mtimeMs;
  return names.sort((a, b) => compare(version(b), version(a)) || time(b) - time(a));
}

/** The app to link to (Get the app), or null when there's none. */
export function latestApp(): string | null {
  return apps()[0] ?? null;
}

/**
 * Each app's newest version, by its name (the file's, before its version: "friends" for
 * friends-0.2.0.apk): what the app compares itself with, to offer an update. The app under its own
 * name (Communarr) also from GitHub, unless the server has a copy of it.
 */
export function latestApps(): { name: string; version: string; url: string }[] {
  const out = new Map<string, { name: string; version: string; url: string }>();
  for (const f of apps()) {
    const m = f.match(/^(.+)-(\d+(?:\.\d+)*)\.apk$/);
    if (m && !out.has(m[1].toLowerCase())) out.set(m[1].toLowerCase(), { name: m[1].toLowerCase(), version: m[2], url: `/${f}` });
  }
  const gh = githubApp();
  if (gh && !out.has(GENERIC)) out.set(GENERIC, { name: GENERIC, version: gh.version, url: `/${GENERIC}-${gh.version}.apk` });
  return [...out.values()];
}

/**
 * The app under its own name, as the repo's android.yml publishes it: the highest android-v* release
 * on GitHub with its APK. GitHub is asked at most once an hour (ten minutes after it couldn't be
 * reached); Check for updates asks now, at most once a minute. It's offered from the site
 * (/communarr-0.2.0.apk, which leads on to GitHub's file), as the app only updates from its server.
 */
export const GENERIC = "communarr";
const REPO = process.env.APP_REPO || "svennefenne/communarr";
const RELEASE_FILE = "communarr-android.apk";
type Release = { version: string; url: string };
const cache = ((globalThis as typeof globalThis & { __hdAppRelease?: { latest: Release | null; ok: boolean; next: number; asked: number; pending: Promise<void> | null } }).__hdAppRelease ??= {
  latest: null,
  ok: false,
  next: 0,
  asked: 0,
  pending: null,
});
const nums = (v: string) => v.split(".").map(Number);

async function askGithub(): Promise<void> {
  cache.asked = Date.now();
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "Communarr" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) throw new Error(`GitHub answered ${r.status}`);
    let best: Release | null = null;
    for (const rel of (await r.json()) as { tag_name?: string; draft?: boolean; prerelease?: boolean; assets?: { name: string; browser_download_url: string }[] }[]) {
      const m = rel.tag_name?.match(/^android-v(\d+(?:\.\d+)*)$/);
      const asset = rel.assets?.find((a) => a.name === RELEASE_FILE);
      if (m && asset && !rel.draft && !rel.prerelease && (!best || compare(nums(m[1]), nums(best.version)) > 0)) best = { version: m[1], url: asset.browser_download_url };
    }
    cache.latest = best;
    cache.ok = true;
    cache.next = Date.now() + 3600_000;
  } catch (e) {
    console.warn(`[apps] couldn't ask GitHub for the app's newest version: ${e instanceof Error ? e.message : e}`);
    cache.ok = false;
    cache.next = Date.now() + 600_000;
  }
}

/** GitHub's newest release of the app as last heard (asked again in the background when it's time). */
export function githubApp(): Release | null {
  if (Date.now() >= cache.next && !cache.pending) cache.pending = askGithub().finally(() => (cache.pending = null));
  return cache.latest;
}

/** The same, asked now (or the answer from under a minute ago): false when GitHub couldn't be reached. */
export async function githubAppNow(): Promise<Release | null | false> {
  if (!cache.pending && Date.now() - cache.asked >= 60_000) cache.pending = askGithub().finally(() => (cache.pending = null));
  await cache.pending;
  return cache.ok ? cache.latest : false;
}
