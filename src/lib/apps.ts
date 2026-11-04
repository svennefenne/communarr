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
 * friends-0.2.0.apk): what the app compares itself with, to offer an update.
 */
export function latestApps(): { name: string; version: string; url: string }[] {
  const out = new Map<string, { name: string; version: string; url: string }>();
  for (const f of apps()) {
    const m = f.match(/^(.+)-(\d+(?:\.\d+)*)\.apk$/);
    if (m && !out.has(m[1].toLowerCase())) out.set(m[1].toLowerCase(), { name: m[1].toLowerCase(), version: m[2], url: `/${f}` });
  }
  return [...out.values()];
}
