import "server-only";
import { db } from "./db";

/** Site settings (Admin). Stored as JSON per key; anything missing falls back to DEFAULTS. */

export interface IceServer {
  urls: string;
  username?: string;
  credential?: string;
}

export interface SiteSettings {
  siteName: string;
  tagline: string;
  /** shown on the log-in page */
  welcome: string;
  footer: string;
  /** invite: invite links only; open: anyone can sign up; closed: nobody new */
  registration: "invite" | "open" | "closed";
  /** new members need an admin's approval before they can log in (open sign-up) */
  approveNew: boolean;
  defaultScheme: string;
  defaultMode: "dark" | "light" | "system";
  allowCustomThemes: boolean;
  frame: boolean;
  /** the glass of the header and frame: 0..100 (opacity) */
  glass: number;
  /** site-wide backgrounds (upload URLs) */
  background: { desktop: string; mobile: string; dim: number; blur: number };
  /** the backdrop drawn behind every page when no picture is set */
  backdrop: "orbits" | "stars" | "grid" | "waves" | "plain";
  announcement: { text: string; style: "info" | "warn" | "party"; on: boolean; id: number };
  features: { forum: boolean; polls: boolean; calendar: boolean; groups: boolean; chat: boolean; voice: boolean; news: boolean };
  /** who may create these (members or only moderators/admins) */
  canCreate: { groups: "members" | "mods"; rooms: "members" | "mods"; events: "members" | "mods"; polls: "members" | "mods" };
  maxUploadMb: number;
  voice: { ice: IceServer[]; max: number };
  /** the time zone for reminders and calendar feeds, e.g. Europe/Stockholm */
  timezone: string;
  /** web push: the contact the push services see (mailto: or https:) */
  pushContact: string;
  /** a word filter for chat and posts: these words are starred out */
  wordFilter: string[];
}

export const DEFAULTS: SiteSettings = {
  siteName: "Hooden",
  tagline: "A closed community place for friends to hang around, chat, discuss, plan and more.",
  welcome: "Welcome home. Log in to see what everyone's up to.",
  footer: "HOODEN · A PLACE FOR FRIENDS",
  registration: "invite",
  approveNew: false,
  defaultScheme: "hooden",
  defaultMode: "dark",
  allowCustomThemes: true,
  frame: true,
  glass: 72,
  background: { desktop: "", mobile: "", dim: 35, blur: 0 },
  backdrop: "orbits",
  announcement: { text: "", style: "info", on: false, id: 0 },
  features: { forum: true, polls: true, calendar: true, groups: true, chat: true, voice: true, news: true },
  canCreate: { groups: "members", rooms: "members", events: "members", polls: "members" },
  maxUploadMb: 20,
  voice: { ice: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }], max: 10 },
  timezone: process.env.TZ || "Europe/Stockholm",
  pushContact: "",
  wordFilter: [],
};

type Key = keyof SiteSettings;

export function getSettings(): SiteSettings {
  const rows = db().prepare("select key, value from settings").all() as { key: string; value: string }[];
  const out: Record<string, unknown> = { ...DEFAULTS };
  for (const r of rows) {
    if (!(r.key in DEFAULTS)) continue;
    try {
      const v = JSON.parse(r.value);
      const d = DEFAULTS[r.key as Key];
      // objects merge over their defaults, so a setting added later gets its default
      out[r.key] = d && typeof d === "object" && !Array.isArray(d) && v && typeof v === "object" ? { ...d, ...v } : v;
    } catch {
      /* keep the default */
    }
  }
  return out as unknown as SiteSettings;
}

export function getSetting<K extends Key>(key: K): SiteSettings[K] {
  return getSettings()[key];
}

export function setSettings(patch: Partial<SiteSettings>) {
  const up = db().prepare("insert into settings (key, value) values (?, ?) on conflict(key) do update set value = excluded.value");
  db().transaction(() => {
    for (const [k, v] of Object.entries(patch)) if (k in DEFAULTS && v !== undefined) up.run(k, JSON.stringify(v));
  })();
}

/** Internal values that aren't settings (VAPID keys and the like). */
export function getMeta(key: string): string | null {
  const r = db().prepare("select value from meta where key = ?").get(key) as { value: string } | undefined;
  return r?.value ?? null;
}
export function setMeta(key: string, value: string) {
  db().prepare("insert into meta (key, value) values (?, ?) on conflict(key) do update set value = excluded.value").run(key, value);
}
