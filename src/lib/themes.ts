import "server-only";
import { db, now } from "./db";
import { cleanTheme, resolveTheme, type ResolvedTheme, type SiteLook, type ThemeData } from "./theme";
import { getSettings } from "./settings";
import { userT } from "./t";
import type { User } from "./users";
import { summaries } from "./users";
import type { UserSummary } from "./types";

export interface ThemeRow {
  id: number;
  user_id: number | null;
  name: string;
  data_json: string;
  shared: number;
  uses: number;
  created_at: number;
  updated_at: number;
}

export interface ThemeInfo {
  id: number;
  name: string;
  data: ThemeData;
  shared: boolean;
  uses: number;
  owner: UserSummary | null;
  mine: boolean;
  updatedAt: number;
}

function toInfo(r: ThemeRow, me: number | null, owners: Map<number, UserSummary>): ThemeInfo {
  let data: ThemeData;
  try {
    data = cleanTheme(JSON.parse(r.data_json));
  } catch {
    data = cleanTheme({});
  }
  return { id: r.id, name: r.name, data, shared: !!r.shared, uses: r.uses, owner: r.user_id ? owners.get(r.user_id) ?? null : null, mine: r.user_id === me, updatedAt: r.updated_at };
}

/** A theme someone may use: their own, or one shared to the gallery. */
export function themeFor(id: number, userId: number): ThemeInfo | null {
  const r = db().prepare("select * from themes where id = ? and (user_id = ? or shared = 1)").get(id, userId) as ThemeRow | undefined;
  if (!r) return null;
  return toInfo(r, userId, summaries(r.user_id ? [r.user_id] : []));
}

export function myThemes(userId: number): ThemeInfo[] {
  const rows = db().prepare("select * from themes where user_id = ? order by updated_at desc").all(userId) as ThemeRow[];
  const owners = summaries([userId]);
  return rows.map((r) => toInfo(r, userId, owners));
}

export function sharedThemes(userId: number): ThemeInfo[] {
  const rows = db().prepare("select * from themes where shared = 1 order by uses desc, updated_at desc limit 200").all() as ThemeRow[];
  const owners = summaries(rows.map((r) => r.user_id!).filter(Boolean));
  return rows.map((r) => toInfo(r, userId, owners));
}

export function saveTheme(userId: number, id: number | null, name: string, data: ThemeData, shared: boolean): number {
  const json = JSON.stringify(cleanTheme(data));
  const t = now();
  const n = name.trim().slice(0, 40) || userT(userId)("My theme");
  if (id) {
    const r = db().prepare("update themes set name = ?, data_json = ?, shared = ?, updated_at = ? where id = ? and user_id = ?").run(n, json, shared ? 1 : 0, t, id, userId);
    if (r.changes) return id;
  }
  return Number(db().prepare("insert into themes (user_id, name, data_json, shared, created_at, updated_at) values (?, ?, ?, ?, ?, ?)").run(userId, n, json, shared ? 1 : 0, t, t).lastInsertRowid);
}

export function siteLook(): SiteLook {
  const s = getSettings();
  return { scheme: s.defaultScheme, mode: s.defaultMode, frame: s.frame, glass: s.glass, backdrop: s.backdrop, background: s.background, backdrops: s.backdrops };
}

/** The theme a page is drawn in, for this member (or a visitor). */
export function themeForUser(user: User | null): ResolvedTheme {
  const s = getSettings();
  let custom: ThemeData | null = null;
  if (user && user.theme.custom && s.allowCustomThemes) custom = themeFor(user.theme.custom, user.id)?.data ?? null;
  return resolveTheme(siteLook(), user ? user.theme : null, custom);
}
