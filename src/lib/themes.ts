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
  /** (no longer kept: picks counted, never taken back. "using" is counted as it is) */
  uses: number;
  created_at: number;
  updated_at: number;
}

/** A theme with how many use it now: members (not its maker, not closed accounts) with it as theirs. */
const SELECT = `select t.*, (select count(*) from users u where u.banned = 0 and u.id is not t.user_id and json_extract(u.theme_json, '$.custom') = t.id) in_use
  from themes t`;
type Row = ThemeRow & { in_use: number };

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

function toInfo(r: Row, me: number | null, owners: Map<number, UserSummary>): ThemeInfo {
  let data: ThemeData;
  try {
    data = cleanTheme(JSON.parse(r.data_json));
  } catch {
    data = cleanTheme({});
  }
  return { id: r.id, name: r.name, data, shared: !!r.shared, uses: r.in_use, owner: r.user_id ? owners.get(r.user_id) ?? null : null, mine: r.user_id === me, updatedAt: r.updated_at };
}

/** A theme someone may use: their own, or one shared to the gallery. */
export function themeFor(id: number, userId: number): ThemeInfo | null {
  const r = db().prepare(`${SELECT} where t.id = ? and (t.user_id = ? or t.shared = 1)`).get(id, userId) as Row | undefined;
  if (!r) return null;
  return toInfo(r, userId, summaries(r.user_id ? [r.user_id] : []));
}

export function myThemes(userId: number): ThemeInfo[] {
  const rows = db().prepare(`${SELECT} where t.user_id = ? order by t.updated_at desc`).all(userId) as Row[];
  const owners = summaries([userId]);
  return rows.map((r) => toInfo(r, userId, owners));
}

export function sharedThemes(userId: number): ThemeInfo[] {
  const rows = db().prepare(`${SELECT} where t.shared = 1 order by in_use desc, t.updated_at desc limit 200`).all() as Row[];
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
