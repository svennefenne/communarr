import type { Presence, ThemePrefs, UserSummary } from "./types";

export interface Me extends UserSummary {
  isAdmin: boolean;
  isMod: boolean;
  presence: Presence;
  theme: ThemePrefs;
}

export interface Features {
  forum: boolean;
  polls: boolean;
  calendar: boolean;
  groups: boolean;
  chat: boolean;
  voice: boolean;
  news: boolean;
}

export interface SiteInfo {
  name: string;
  tagline: string;
  footer: string;
  features: Features;
  /** what this member may start */
  can: { groups: boolean; rooms: boolean; events: boolean; polls: boolean; news: boolean };
  allowCustomThemes: boolean;
  vapidKey: string | null;
  maxUploadMb: number;
  announcement: { text: string; style: "info" | "warn" | "party"; id: number } | null;
  registration: "invite" | "open" | "closed";
}

export interface Boot {
  me: Me | null;
  site: SiteInfo;
  counts: { notifications: number; chat: number; rooms: Record<number, number> };
}
