import type { Clock } from "./clock";
import type { SoundSettings } from "./sounds";
import type { Lang, Own } from "./i18n";
import type { BggMode, CustomEmoji, Presence, ThemePrefs, UserSummary } from "./types";

export interface Me extends UserSummary {
  isAdmin: boolean;
  isMod: boolean;
  presence: Presence;
  theme: ThemePrefs;
  /** the groups they're in (when the page loaded) */
  groups: number[];
}

export interface Features {
  forum: boolean;
  polls: boolean;
  lists: boolean;
  calendar: boolean;
  groups: boolean;
  chat: boolean;
  voice: boolean;
  news: boolean;
}

export interface SiteInfo {
  /** the viewer's language (their own choice, else the site's) */
  lang: Lang;
  /** the admin's own wording for that language (Admin → Texts) */
  texts: Own;
  name: string;
  /** the admin's own logo, in place of the stripes (null: the stripes) */
  logo: string | null;
  tagline: string;
  footer: string;
  features: Features;
  /** what this member may start (emojis: add the site's own) */
  can: { groups: boolean; rooms: boolean; events: boolean; polls: boolean; news: boolean; emojis: boolean; lists: boolean };
  /** the site's own emoji (logged in only) */
  emojis: CustomEmoji[];
  /** Google's animated emoji to pick from when adding one (Admin → Features & permissions) */
  emojiLibrary: boolean;
  /** bgg: in the editor (board games on BoardGameGeek) */
  bgg: BggMode;
  allowCustomThemes: boolean;
  vapidKey: string | null;
  maxUploadMb: number;
  announcement: { text: string; style: "info" | "warn" | "party"; id: number } | null;
  registration: "invite" | "open" | "closed";
  /** 24-hour or 12-hour times, and the first day of the week */
  clock: Clock;
  /** the server's own Android app to download (/communarr-0.1.0.apk), or null: the one on GitHub */
  androidApp: string | null;
  /** each of the server's own apps' newest version (by the app's name, lower case), for the app to offer an update */
  androidApps: { name: string; version: string; url: string }[];
  /** the site's sounds (Admin → Sounds; logged in only) */
  sounds: SoundSettings | null;
}

export interface Boot {
  me: Me | null;
  site: SiteInfo;
  counts: { notifications: number; chat: number; rooms: Record<number, number> };
}
