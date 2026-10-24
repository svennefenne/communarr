import "server-only";
import { db } from "./db";
import { defaultTextIn, getSettings } from "./settings";
import type { Boot, Me, SiteInfo } from "./bootTypes";
import type { Lang } from "./i18n";
import type { User } from "./users";
import { summary } from "./users";
import { vapidPublicKey } from "./push";
import { withDefaults } from "./sounds";

export function me(u: User): Me {
  // (the groups they're in: a sound for a group's new post only plays for its members)
  const groups = (db().prepare("select group_id from group_members where user_id = ?").all(u.id) as { group_id: number }[]).map((r) => r.group_id);
  return { ...summary(u), isAdmin: u.isAdmin, isMod: u.isMod, presence: u.presence, theme: u.theme, groups };
}

export function siteInfo(u: User | null, lang?: Lang): SiteInfo {
  const s = getSettings();
  const may = (who: "members" | "mods") => !!u && (who === "members" || u.isMod);
  const a = s.announcement;
  return {
    lang: lang ?? s.language,
    texts: s.texts[lang ?? s.language] ?? {},
    name: s.siteName,
    tagline: defaultTextIn("tagline", s.tagline, lang ?? s.language),
    footer: defaultTextIn("footer", s.footer, lang ?? s.language),
    features: s.features,
    can: { groups: may(s.canCreate.groups), rooms: may(s.canCreate.rooms), events: may(s.canCreate.events), polls: may(s.canCreate.polls), news: !!u?.isMod },
    allowCustomThemes: s.allowCustomThemes,
    vapidKey: u ? vapidPublicKey() : null,
    maxUploadMb: s.maxUploadMb,
    announcement: a.on && a.text.trim() ? { text: a.text, style: a.style, id: a.id } : null,
    registration: s.registration,
    clock: { timeFormat: s.timeFormat, weekStart: s.weekStart },
    sounds: u ? withDefaults(s.sounds) : null,
  };
}

/** Unread messages per room (rooms with any), for someone. */
export function roomUnread(userId: number): Record<number, number> {
  const rows = db()
    .prepare(
      `select rm.room_id id, (select count(*) from messages m where m.room_id = rm.room_id and m.id > rm.last_read_id and m.deleted = 0 and m.kind = 'text' and (m.author_id is null or m.author_id != rm.user_id)) n
       from room_members rm join rooms r on r.id = rm.room_id
       where rm.user_id = ? and r.archived = 0 and rm.notify != 'none'`,
    )
    .all(userId) as { id: number; n: number }[];
  const out: Record<number, number> = {};
  for (const r of rows) if (r.n) out[r.id] = r.n;
  return out;
}

export function unreadNotifications(userId: number): number {
  return (db().prepare("select count(*) n from notifications where user_id = ? and read_at is null").get(userId) as { n: number }).n;
}

/** What the browser starts with; lang is the viewer's language (requestLang()). */
export function boot(u: User | null, lang?: Lang): Boot {
  const rooms = u ? roomUnread(u.id) : {};
  return {
    me: u ? me(u) : null,
    site: siteInfo(u, lang),
    counts: { notifications: u ? unreadNotifications(u.id) : 0, chat: Object.keys(rooms).length, rooms },
  };
}
