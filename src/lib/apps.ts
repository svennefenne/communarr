import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/lib/db";

/**
 * The server's own copies of the Android app (built with a name of their own, android/ -PappName):
 * .apk files put in the data folder's apps/, downloaded from the site's root (/communarr-0.1.0.apk) by
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

/** The app to link to: the highest version in its name (communarr-0.2.0.apk), else the one put there last; null when there's none. */
export function latestApp(): string | null {
  let names: string[];
  try {
    names = fs.readdirSync(APPS_DIR).filter((n) => APP_NAME.test(n));
  } catch {
    return null;
  }
  const version = (n: string) => (n.match(/-(\d+(?:\.\d+)*)\.apk$/)?.[1] ?? "").split(".").filter(Boolean).map(Number);
  const compare = (a: number[], b: number[]) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
    return 0;
  };
  const time = (n: string) => fs.statSync(path.join(APPS_DIR, n)).mtimeMs;
  return names.sort((a, b) => compare(version(b), version(a)) || time(b) - time(a))[0] ?? null;
}
