import "server-only";
import { UserError } from "./errors";
import crypto from "node:crypto";
import { db, now, tx } from "./db";
import { notify } from "./notify";
import { reactionsFor, clearReactions } from "./reactions";
import { cleanHtml, cleanLine } from "./sanitize";
import { indexItem, unindex } from "./search";
import { canPostInGroup, canReadGroup, groupFilter, groupRow, groupScope, memberIdsOf } from "./groups";
import { GHOST, summaries, userByName, usersWho, type User } from "./users";
import { broadcast } from "./hub";
import { commentCounts, groupRefs } from "./posts";
import { getMeta, getSettings, setMeta } from "./settings";
import { serverT } from "./t";
import type { T } from "./i18n";
import type { EventView, RsvpStatus } from "./contentTypes";

export interface EventRow {
  id: number;
  author_id: number;
  title: string;
  description_html: string;
  description_text: string;
  location: string;
  start_at: number;
  end_at: number;
  all_day: number;
  color: string | null;
  cover: string | null;
  group_id: number | null;
  repeat: "none" | "daily" | "weekly" | "monthly" | "yearly";
  repeat_until: number | null;
  capacity: number | null;
  cancelled: number;
  created_at: number;
  edited_at: number | null;
}

export class EventError extends UserError {}

export const EVENT_COLORS = ["#d65a2b", "#e2a634", "#2f7088", "#4f8f50", "#9c5bb5", "#d4689a", "#5b7bd6", "#c8412f"];

export function eventRow(id: number): EventRow | null {
  return (db().prepare("select * from events where id = ?").get(id) as EventRow | undefined) ?? null;
}

export function canSeeEvent(u: User, e: EventRow) {
  if (!e.group_id) return true;
  const g = groupRow(e.group_id);
  return !!g && canReadGroup(u, g);
}

/** The starts of an event's occurrences between from and to (one for a one-off). */
export function occurrences(e: Pick<EventRow, "start_at" | "end_at" | "repeat" | "repeat_until">, from: number, to: number, max = 400): number[] {
  const len = e.end_at - e.start_at;
  if (e.repeat === "none") return e.start_at < to && e.start_at + len > from ? [e.start_at] : [];
  const out: number[] = [];
  const d = new Date(e.start_at);
  const until = e.repeat_until ?? Infinity;
  for (let i = 0; i < 5000 && out.length < max; i++) {
    const t = d.getTime();
    if (t >= to || t > until) break;
    if (t + len > from) out.push(t);
    // step in local time (the server's TZ), so 18:00 stays 18:00 across summer time
    if (e.repeat === "daily") d.setDate(d.getDate() + 1);
    else if (e.repeat === "weekly") d.setDate(d.getDate() + 7);
    else if (e.repeat === "monthly") d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
  }
  return out;
}

export function toEventViews(u: User, rows: EventRow[]): EventView[] {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const authors = summaries(rows.map((r) => r.author_id));
  const groups = groupRefs(rows.map((r) => r.group_id));
  const reacts = reactionsFor("event", ids, u.id);
  const counts = commentCounts("event", ids);
  const rs = db().prepare(`select event_id, user_id, status from event_rsvps where event_id in (${ids.map(() => "?").join(",")}) order by updated_at`).all(...ids) as { event_id: number; user_id: number; status: RsvpStatus }[];
  const people = summaries(rs.map((r) => r.user_id));
  return rows.map((r) => {
    const mine = rs.find((x) => x.event_id === r.id && x.user_id === u.id);
    const who = (s: RsvpStatus) => rs.filter((x) => x.event_id === r.id && x.status === s).map((x) => people.get(x.user_id)!).filter(Boolean);
    return {
      id: r.id,
      title: r.title,
      html: r.description_html,
      location: r.location,
      startAt: r.start_at,
      endAt: r.end_at,
      allDay: !!r.all_day,
      color: r.color || "#d65a2b",
      cover: r.cover,
      group: r.group_id ? groups.get(r.group_id) ?? null : null,
      author: authors.get(r.author_id) ?? GHOST,
      repeat: r.repeat,
      repeatUntil: r.repeat_until,
      capacity: r.capacity,
      cancelled: !!r.cancelled,
      createdAt: r.created_at,
      going: who("going"),
      maybe: who("maybe"),
      no: who("no"),
      mine: mine?.status ?? null,
      comments: counts.get(r.id) ?? 0,
      reactions: reacts.get(r.id) ?? [],
      canEdit: r.author_id === u.id || u.isMod,
    };
  });
}

export function getEvent(u: User, id: number): EventView | null {
  const e = eventRow(id);
  if (!e || !canSeeEvent(u, e)) return null;
  return toEventViews(u, [e])[0];
}

/** Every occurrence between from and to that someone can see. */
export function eventsBetween(u: User, from: number, to: number, o: { groupId?: number; mineOnly?: boolean } = {}): EventView[] {
  const gf = groupFilter(u);
  const where = [gf.sql, "start_at < ?", "((repeat = 'none' and end_at > ?) or (repeat != 'none' and (repeat_until is null or repeat_until >= ?)))"];
  const params: unknown[] = [...gf.params, to, from, from];
  if (o.groupId) {
    where.push("group_id = ?");
    params.push(o.groupId);
  }
  if (o.mineOnly) {
    where.push("(author_id = ? or id in (select event_id from event_rsvps where user_id = ? and status in ('going','maybe')))");
    params.push(u.id, u.id);
  }
  const rows = db().prepare(`select * from events where ${where.join(" and ")}`).all(...params) as EventRow[];
  const views = new Map(toEventViews(u, rows).map((v) => [v.id, v]));
  const out: EventView[] = [];
  for (const r of rows) {
    const v = views.get(r.id)!;
    const len = r.end_at - r.start_at;
    for (const s of occurrences(r, from, to)) out.push({ ...v, occurrence: s, startAt: s, endAt: s + len });
  }
  return out.sort((a, b) => a.startAt - b.startAt);
}

export function upcoming(u: User, limit = 5, o: { groupId?: number } = {}): EventView[] {
  const t = now();
  return eventsBetween(u, t, t + 366 * 86_400_000, o)
    .filter((e) => !e.cancelled)
    .slice(0, limit);
}

export interface EventInput {
  title: string;
  html?: string;
  location?: string;
  startAt: number;
  endAt: number;
  allDay?: boolean;
  color?: string;
  cover?: string | null;
  groupId?: number | null;
  repeat?: EventRow["repeat"];
  repeatUntil?: number | null;
  capacity?: number | null;
}

function validate(o: EventInput) {
  const title = cleanLine(o.title, 140);
  if (!title) throw new EventError("Give the event a name.");
  if (!Number.isFinite(o.startAt)) throw new EventError("When does it start?");
  let end = Number.isFinite(o.endAt) && o.endAt > o.startAt ? o.endAt : o.startAt + (o.allDay ? 86_400_000 - 1 : 2 * 3600_000);
  if (end - o.startAt > 60 * 86_400_000) end = o.startAt + 60 * 86_400_000;
  const repeat = o.repeat && ["daily", "weekly", "monthly", "yearly"].includes(o.repeat) ? o.repeat : "none";
  return {
    title,
    c: cleanHtml(o.html || ""),
    location: cleanLine(o.location, 200),
    start: o.startAt,
    end,
    allDay: o.allDay ? 1 : 0,
    color: o.color && /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : null,
    cover: o.cover && /^\/media\/[\w./-]+$/.test(o.cover) ? o.cover : null,
    repeat,
    repeatUntil: repeat !== "none" && o.repeatUntil && o.repeatUntil > o.startAt ? o.repeatUntil : null,
    capacity: o.capacity && o.capacity > 0 ? Math.min(10000, Math.round(o.capacity)) : null,
  };
}

export function createEvent(u: User, o: EventInput): number {
  const v = validate(o);
  let groupId: number | null = null;
  if (o.groupId) {
    const g = groupRow(o.groupId);
    if (!g || !canPostInGroup(u, g)) throw new EventError("You can only plan events in groups you're in.");
    groupId = g.id;
  }
  const t = now();
  const id = tx(() => {
    const id = Number(
      db()
        .prepare(
          "insert into events (author_id, title, description_html, description_text, location, start_at, end_at, all_day, color, cover, group_id, repeat, repeat_until, capacity, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(u.id, v.title, v.c.html, v.c.text, v.location, v.start, v.end, v.allDay, v.color, v.cover, groupId, v.repeat, v.repeatUntil, v.capacity, t).lastInsertRowid,
    );
    // the one who plans it is going
    db().prepare("insert into event_rsvps (event_id, user_id, status, updated_at) values (?, ?, 'going', ?)").run(id, u.id, t);
    indexItem("event", id, groupScope(groupId), u.id, t, v.title, `${v.location} ${v.c.text}`);
    return id;
  });
  const url = `/events/${id}`;
  const row = eventRow(id)!;
  const vars = { name: u.name, title: v.title, when: when(v.start, !!v.allDay, serverT().locale) };
  const mentioned = usersWho(v.c.mentions.map((n) => userByName(n)?.id).filter((x): x is number => !!x), (x) => canSeeEvent(x, row));
  if (mentioned.length) notify(mentioned, { kind: "invite", actorId: u.id, title: "{name} invited you to {title}", body: "{when}", vars, url });
  if (groupId) notify(memberIdsOf(groupId).filter((x) => !mentioned.includes(x)), { kind: "group", actorId: u.id, title: "New event in {group}: {title}", body: "{when}", vars: { ...vars, group: groupRow(groupId)!.name }, url });
  broadcast("feed", { type: "event", id, by: u.id, group: groupId });
  return id;
}

function when(t: number, allDay: boolean, locale: string | undefined) {
  const tz = getSettings().timezone;
  try {
    return new Intl.DateTimeFormat(locale ?? "en-GB", { weekday: "short", day: "numeric", month: "short", ...(allDay ? {} : { hour: "2-digit", minute: "2-digit" }), timeZone: tz }).format(new Date(t));
  } catch {
    return new Date(t).toUTCString();
  }
}

function attendees(id: number): number[] {
  return (db().prepare("select user_id from event_rsvps where event_id = ? and status in ('going','maybe')").all(id) as { user_id: number }[]).map((r) => r.user_id);
}

export function updateEvent(u: User, id: number, o: EventInput) {
  const e = eventRow(id);
  if (!e) throw new EventError("That event is gone.");
  if (e.author_id !== u.id && !u.isMod) throw new EventError("Only the one who planned it can change the event.");
  const v = validate(o);
  db()
    .prepare("update events set title = ?, description_html = ?, description_text = ?, location = ?, start_at = ?, end_at = ?, all_day = ?, color = ?, cover = ?, repeat = ?, repeat_until = ?, capacity = ?, edited_at = ? where id = ?")
    .run(v.title, v.c.html, v.c.text, v.location, v.start, v.end, v.allDay, v.color, v.cover, v.repeat, v.repeatUntil, v.capacity, now(), id);
  indexItem("event", id, groupScope(e.group_id), e.author_id, e.created_at, v.title, `${v.location} ${v.c.text}`);
  // a new time or place is worth a ping; reminders go out again for the new time
  const moved = v.start !== e.start_at || v.end !== e.end_at;
  if (moved) db().prepare("delete from event_reminders where event_id = ?").run(id);
  if (moved || v.location !== e.location) {
    // the body is one whole text, so it can be translated for each person
    const place = v.location !== e.location ? (v.location ? "at {place}" : "at a place to be decided") : "";
    const body = moved ? (place ? `Now {when}, ${place}` : "Now {when}") : place;
    notify(attendees(id), {
      kind: "event",
      actorId: u.id,
      title: "{title} changed",
      body,
      vars: { title: v.title, when: when(v.start, !!v.allDay, serverT().locale), place: v.location },
      url: `/events/${id}`,
    });
  }
}

export function cancelEvent(u: User, id: number, cancelled: boolean) {
  const e = eventRow(id);
  if (!e) return;
  if (e.author_id !== u.id && !u.isMod) throw new EventError("Only the one who planned it can cancel the event.");
  db().prepare("update events set cancelled = ? where id = ?").run(cancelled ? 1 : 0, id);
  notify(attendees(id), { kind: "event", actorId: u.id, title: cancelled ? "Cancelled: {title}" : "Back on: {title}", body: "{when}", vars: { title: e.title, when: when(e.start_at, !!e.all_day, serverT().locale) }, url: `/events/${id}` });
}

export function deleteEvent(u: User, id: number) {
  const e = eventRow(id);
  if (!e) return;
  if (e.author_id !== u.id && !u.isMod) throw new EventError("Only the one who planned it can delete the event.");
  db().prepare("delete from events where id = ?").run(id);
  db().prepare("delete from comments where target_type = 'event' and target_id = ?").run(id);
  db().prepare("delete from bookmarks where target_type = 'event' and target_id = ?").run(id);
  clearReactions("event", id);
  unindex("event", id);
}

export function rsvp(u: User, id: number, status: RsvpStatus | null) {
  const e = eventRow(id);
  if (!e || !canSeeEvent(u, e)) throw new EventError("That event is gone.");
  if (e.cancelled) throw new EventError("The event is cancelled.");
  const before = db().prepare("select status from event_rsvps where event_id = ? and user_id = ?").get(id, u.id) as { status: RsvpStatus } | undefined;
  if (!status) {
    db().prepare("delete from event_rsvps where event_id = ? and user_id = ?").run(id, u.id);
    return;
  }
  if (status === "going" && e.capacity && before?.status !== "going") {
    const n = (db().prepare("select count(*) n from event_rsvps where event_id = ? and status = 'going'").get(id) as { n: number }).n;
    if (n >= e.capacity) throw new EventError("It's full ({n} places). Say maybe and keep an eye on it.", { n: e.capacity });
  }
  db().prepare("insert into event_rsvps (event_id, user_id, status, updated_at) values (?, ?, ?, ?) on conflict(event_id, user_id) do update set status = excluded.status, updated_at = excluded.updated_at").run(id, u.id, status, now());
  if (status === "going" && before?.status !== "going" && e.author_id !== u.id) notify([e.author_id], { kind: "event", actorId: u.id, title: "{name} is going to {title}", vars: { name: u.name, title: e.title }, url: `/events/${id}` });
}

/** A day and an hour before: a reminder for everyone going (or maybe going). Run every minute. */
export function sendReminders() {
  const t = now();
  const locale = serverT().locale;
  const rows = db()
    .prepare("select * from events where cancelled = 0 and start_at < ? and ((repeat = 'none' and start_at > ?) or (repeat != 'none' and (repeat_until is null or repeat_until >= ?)))")
    .all(t + 25 * 3600_000, t, t) as EventRow[];
  for (const e of rows) {
    for (const occ of occurrences(e, t, t + 25 * 3600_000, 3)) {
      const left = occ - t;
      const kinds: [string, boolean][] = [
        ["1h", left <= 60 * 60_000 && left > 0],
        ["1d", left <= 24 * 3600_000 && left > 2 * 3600_000 && occ - e.created_at > 24 * 3600_000],
      ];
      for (const [kind, due] of kinds) {
        if (!due) continue;
        const r = db().prepare("insert or ignore into event_reminders (event_id, occurrence, kind) values (?, ?, ?)").run(e.id, occ, kind);
        if (!r.changes) continue;
        const who = [...new Set([...attendees(e.id), e.author_id])];
        notify(who, {
          kind: "event",
          title: kind === "1h" ? "Soon: {title}" : "Tomorrow: {title}",
          body: e.location ? "{when} · {place}" : "{when}",
          vars: { title: e.title, when: when(occ, !!e.all_day, locale), place: e.location },
          url: `/events/${e.id}`,
          tag: `event-${e.id}`,
        });
      }
    }
  }
}

// ── calendar feeds (.ics) for phone and computer calendars ──

export function feedToken(userId: number): string {
  const key = `icsuser.${userId}`;
  let tok = getMeta(key);
  if (!tok) {
    tok = crypto.randomBytes(18).toString("base64url");
    setMeta(key, tok);
    setMeta(`icstoken.${tok}`, String(userId));
  }
  return tok;
}

export function resetFeedToken(userId: number): string {
  const old = getMeta(`icsuser.${userId}`);
  if (old) db().prepare("delete from meta where key = ?").run(`icstoken.${old}`);
  db().prepare("delete from meta where key = ?").run(`icsuser.${userId}`);
  return feedToken(userId);
}

export function userForFeed(token: string): number | null {
  const v = getMeta(`icstoken.${token}`);
  return v ? Number(v) : null;
}

const icsEsc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const icsTime = (t: number) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
function icsDate(t: number) {
  const tz = getSettings().timezone;
  try {
    const p = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: tz }).format(new Date(t));
    return p.replace(/-/g, "");
  } catch {
    return icsTime(t).slice(0, 8);
  }
}
function fold(line: string) {
  const out: string[] = [];
  let s = line;
  while (s.length > 74) {
    out.push(s.slice(0, 74));
    s = " " + s.slice(74);
  }
  out.push(s);
  return out.join("\r\n");
}

export function icsFor(rows: EventRow[], name: string, baseUrl: string, t: T): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hooden//Calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsEsc(name)}`];
  for (const e of rows) {
    lines.push("BEGIN:VEVENT", `UID:hooden-event-${e.id}@hooden`, `DTSTAMP:${icsTime(e.edited_at ?? e.created_at)}`);
    if (e.all_day) {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(e.start_at)}`, `DTEND;VALUE=DATE:${icsDate(e.end_at + 1)}`);
    } else lines.push(`DTSTART:${icsTime(e.start_at)}`, `DTEND:${icsTime(e.end_at)}`);
    if (e.repeat !== "none") lines.push(`RRULE:FREQ=${e.repeat.toUpperCase()}${e.repeat_until ? `;UNTIL=${icsTime(e.repeat_until)}` : ""}`);
    lines.push(fold(`SUMMARY:${icsEsc(e.cancelled ? t("CANCELLED: {title}", { title: e.title }) : e.title)}`));
    if (e.location) lines.push(fold(`LOCATION:${icsEsc(e.location)}`));
    lines.push(fold(`DESCRIPTION:${icsEsc(e.description_text.slice(0, 2000))}`));
    if (baseUrl) lines.push(fold(`URL:${baseUrl}/events/${e.id}`));
    if (e.cancelled) lines.push("STATUS:CANCELLED");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

/** Someone's calendar feed: what they're going to (or everything they can see). */
export function feedEvents(userId: number, all: boolean): EventRow[] {
  const t = now() - 60 * 86_400_000;
  if (all) {
    const u = { id: userId, isMod: false } as User;
    const gf = groupFilter(u);
    return db().prepare(`select * from events where ${gf.sql} and (end_at > ? or repeat != 'none')`).all(...gf.params, t) as EventRow[];
  }
  return db().prepare("select * from events where (end_at > ? or repeat != 'none') and (author_id = ? or id in (select event_id from event_rsvps where user_id = ? and status in ('going','maybe')))").all(t, userId, userId) as EventRow[];
}
