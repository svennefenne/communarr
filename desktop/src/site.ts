import fs from "node:fs";
import path from "node:path";

/**
 * Which app this is. Built from the repo it's Communarr, and asks for its server the first time. A
 * server's own copy (scripts/site-desktop.sh) has a site.json in its resources with a name of its own
 * ("Friends"), an id of its own (so it installs beside Communarr) and the server's address, where it
 * goes straight away.
 */
export interface Site {
  name: string;
  id: string;
  server: string | null;
}

export const GENERIC: Site = { name: "Communarr", id: "io.github.svennefenne.communarr", server: null };

/** A server's address as the app keeps it: its origin, https (or http on this computer only). */
export function origin(address: string): string | null {
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(address.trim()) ? address.trim() : `https://${address.trim()}`);
  } catch {
    return null;
  }
  if (u.username || u.password) return null;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return null;
  return u.origin;
}

export function parseSite(text: string): Site | null {
  let s: Partial<Site>;
  try {
    s = JSON.parse(text) as Partial<Site>;
  } catch {
    return null;
  }
  const name = typeof s.name === "string" ? s.name.trim() : "";
  const id = typeof s.id === "string" ? s.id.trim() : "";
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,39}$/u.test(name) || !/^[a-z][a-z\d_]*(\.[a-z][a-z\d_]*)+$/i.test(id)) return null;
  const server = typeof s.server === "string" && s.server ? origin(s.server) : null;
  return { name, id, server };
}

/** site.json beside the app's code (COMMUNARR_SITE: another one, for trying a server's copy from source). */
export function loadSite(resources: string): Site {
  const file = process.env.COMMUNARR_SITE || path.join(resources, "site.json");
  try {
    return parseSite(fs.readFileSync(file, "utf8")) ?? GENERIC;
  } catch {
    return GENERIC;
  }
}

/** The app's name in a file's name ("friends-desktop-0.2.0-…"): the server lists its copies by it. */
export const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "app";

/** This computer, as the app's files are named for it. */
export type Platform = "linux-x86_64" | "windows-x64" | "macos-arm64";
export const PLATFORM: Platform = process.platform === "win32" ? "windows-x64" : process.platform === "darwin" ? "macos-arm64" : "linux-x86_64";
export const FILE_END: Record<Platform, string> = {
  "linux-x86_64": "linux-x86_64.AppImage",
  "windows-x64": "windows-x64-setup.exe",
  "macos-arm64": "macos-arm64.zip",
};

/** An update's file on the server, for this computer: /friends-desktop-0.2.0-linux-x86_64.AppImage */
export function updateFile(url: string, server: string): URL | null {
  let u: URL;
  try {
    u = new URL(url, server);
  } catch {
    return null;
  }
  const end = FILE_END[PLATFORM].replace(/\./g, "\\.");
  return u.origin === server && new RegExp(`^/[a-z0-9][a-z0-9.-]*-desktop-\\d+(?:\\.\\d+)*-${end}$`).test(u.pathname) && !u.search ? u : null;
}

/** Where a download may lead: the server, GitHub's release of the app, and GitHub's file storage. */
export function trusted(url: URL, server: string): boolean {
  if (url.origin === server) return true;
  if (url.protocol !== "https:") return false;
  if (url.hostname === "github.com") return /^\/svennefenne\/communarr\/releases\/download\/desktop-v[\d.]+\/communarr-desktop-[\w.-]+$/.test(url.pathname);
  return url.hostname === "objects.githubusercontent.com" || url.hostname === "release-assets.githubusercontent.com";
}

/** What the app remembers, in its data folder's settings.json. */
export interface Settings {
  server?: string;
  bounds?: { x: number; y: number; width: number; height: number };
  maximized?: boolean;
  /** the site's language, as its pages say (the app's own words follow it) */
  lang?: string;
  /** told once that closing the window leaves it in the tray */
  toldTray?: boolean;
}

export class Store {
  private file: string;
  data: Settings;
  constructor(dir: string) {
    this.file = path.join(dir, "settings.json");
    try {
      this.data = JSON.parse(fs.readFileSync(this.file, "utf8")) as Settings;
    } catch {
      this.data = {};
    }
  }
  set(patch: Partial<Settings>) {
    this.data = { ...this.data, ...patch };
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(`${this.file}.tmp`, JSON.stringify(this.data, null, 2));
      fs.renameSync(`${this.file}.tmp`, this.file);
    } catch (e) {
      console.error("couldn't save the settings:", e);
    }
  }
}

/** a.b.c > x.y.z */
export function newer(a: string, b: string): boolean {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}
