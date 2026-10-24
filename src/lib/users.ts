import "server-only";
import { db } from "./db";
import type { NotifyKind, NotifyPrefs, Presence, Role, ThemePrefs, UserSummary } from "./types";
import { NOTIFY_KINDS } from "./types";
import { getSetting, getSettings } from "./settings";
import { makeT } from "./i18n";

export interface UserRow {
  id: number;
  username: string;
  display_name: string;
  password_hash: string;
  role: Role;
  avatar: string | null;
  banner: string | null;
  bio_html: string;
  pronouns: string;
  location: string;
  website: string;
  birthday: string | null;
  accent: string | null;
  status_text: string;
  status_emoji: string;
  status_until: number | null;
  presence: Presence;
  theme_json: string | null;
  notify_json: string | null;
  suspended_until: number | null;
  banned: number;
  ban_reason: string | null;
  invited_by: number | null;
  created_at: number;
  last_seen: number | null;
  /** confirmed only (the one waiting to be confirmed is on its mail_tokens link) */
  email: string | null;
  mail_token: string | null;
}

export interface User {
  id: number;
  username: string;
  name: string;
  role: Role;
  isAdmin: boolean;
  isMod: boolean;
  avatar: string | null;
  banner: string | null;
  accent: string;
  bioHtml: string;
  pronouns: string;
  location: string;
  website: string;
  birthday: string | null;
  statusText: string;
  statusEmoji: string;
  statusUntil: number | null;
  presence: Presence;
  theme: ThemePrefs;
  notify: NotifyPrefs;
  createdAt: number;
  lastSeen: number | null;
  banned: boolean;
  suspendedUntil: number | null;
}

const ACCENTS = ["#d65a2b", "#e2a634", "#2f7088", "#4d9ab4", "#3f8a4c", "#c8412f", "#9c5bb5", "#d4689a", "#5b7bd6", "#2fa39a"];

/** A stable colour for someone without one of their own. */
export function accentFor(username: string, accent?: string | null) {
  if (accent) return accent;
  let h = 0;
  for (const c of username.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

export function defaultTheme(): ThemePrefs {
  const s = getSettings();
  return { scheme: s.defaultScheme, mode: s.defaultMode, custom: null, wipes: true, motion: true, textSize: 100, density: "comfy" };
}

/** what comes by mail unless you say otherwise (only while you're away, and only to a confirmed address) */
export const MAIL_KINDS: NotifyKind[] = ["dm", "mention", "invite", "news"];

export function defaultNotify(): NotifyPrefs {
  const out: Record<string, unknown> = { quietFrom: "", quietTo: "" };
  for (const k of Object.keys(NOTIFY_KINDS) as NotifyKind[]) out[k] = { app: true, push: k !== "reaction" && k !== "room", mail: MAIL_KINDS.includes(k) };
  return out as NotifyPrefs;
}

/** Someone's saved choices over the defaults, kind by kind (a switch added later gets its default). */
function notifyPrefs(json: string | null): NotifyPrefs {
  const d = defaultNotify();
  const saved = parse(json, {} as Partial<NotifyPrefs>) as Record<string, unknown>;
  const out = { ...d, ...saved } as NotifyPrefs;
  for (const k of Object.keys(NOTIFY_KINDS) as NotifyKind[]) out[k] = { ...d[k], ...((saved[k] as object) ?? {}) };
  return out;
}

function parse<T extends object>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? { ...fallback, ...v } : fallback;
  } catch {
    return fallback;
  }
}

export function toUser(r: UserRow): User {
  const expired = r.status_until != null && r.status_until < Date.now();
  return {
    id: r.id,
    username: r.username,
    name: r.display_name,
    role: r.role,
    isAdmin: r.role === "admin",
    isMod: r.role === "admin" || r.role === "moderator",
    avatar: r.avatar,
    banner: r.banner,
    accent: accentFor(r.username, r.accent),
    bioHtml: r.bio_html,
    pronouns: r.pronouns,
    location: r.location,
    website: r.website,
    birthday: r.birthday,
    statusText: expired ? "" : r.status_text,
    statusEmoji: expired ? "" : r.status_emoji,
    statusUntil: expired ? null : r.status_until,
    presence: r.presence,
    theme: parse(r.theme_json, defaultTheme()),
    notify: notifyPrefs(r.notify_json),
    createdAt: r.created_at,
    lastSeen: r.last_seen,
    banned: !!r.banned,
    suspendedUntil: r.suspended_until,
  };
}

export function summary(u: User | UserRow): UserSummary {
  if ("password_hash" in u) u = toUser(u);
  return { id: u.id, username: u.username, name: u.name, avatar: u.avatar, accent: u.accent, role: u.role, statusText: u.statusText, statusEmoji: u.statusEmoji };
}

export function userById(id: number): User | null {
  const r = db().prepare("select * from users where id = ?").get(id) as UserRow | undefined;
  return r ? toUser(r) : null;
}

export function userByName(username: string): User | null {
  const r = db().prepare("select * from users where username = ?").get(username) as UserRow | undefined;
  return r ? toUser(r) : null;
}

/** Summaries for many ids at once (missing ones are left out). */
export function summaries(ids: Iterable<number>): Map<number, UserSummary> {
  const list = [...new Set([...ids].filter((x) => x != null))];
  const out = new Map<number, UserSummary>();
  if (!list.length) return out;
  const rows = db()
    .prepare(`select * from users where id in (${list.map(() => "?").join(",")})`)
    .all(...list) as UserRow[];
  for (const r of rows) out.set(r.id, summary(r));
  return out;
}

/** Of these people, the ones for whom `check` holds (who may see something, before telling them about it). */
export function usersWho(ids: Iterable<number>, check: (u: User) => boolean): number[] {
  return [...new Set(ids)].filter((id) => {
    const u = userById(id);
    return !!u && !u.banned && check(u);
  });
}

export const GHOST: UserSummary = {
  id: 0,
  username: "ghost",
  // read when it's shown, in the site's language (not via ./t: that imports auth, which imports this)
  get name() {
    return makeT(getSetting("language"))("Former member");
  },
  avatar: null,
  accent: "#6b7280",
  role: "member",
  statusText: "",
  statusEmoji: "",
};

export function allMembers(): UserSummary[] {
  const rows = db().prepare("select * from users where banned = 0 order by display_name collate nocase").all() as UserRow[];
  return rows.map(summary);
}

export const USERNAME_RE = /^[a-zA-Z0-9_.-]{2,24}$/;

export function memberCount(): number {
  return (db().prepare("select count(*) n from users where banned = 0").get() as { n: number }).n;
}
