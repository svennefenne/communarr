import "server-only";
import { UserError } from "./errors";
import { db, now, tx } from "./db";
import { broadcast, isInRoom, sendTo, sendToMany } from "./hub";
import { kickFromVoice } from "./voice";
import { notify } from "./notify";
import { reactionsFor, reactionsRaw, clearReactions, toggleReaction } from "./reactions";
import { cleanHtml, cleanLine, textToHtml } from "./sanitize";
import { indexItem, unindex } from "./search";
import { serverT } from "./t";
import { getSettings } from "./settings";
import { GHOST, summaries, userByName, type User } from "./users";
import { byPlace, type ChatMessage, type MemberRole, type RoomInfo, type RoomKind, type RoomMember, type RoomVisibility } from "./chatTypes";
import type { UserSummary } from "./types";

export interface RoomRow {
  id: number;
  name: string;
  topic: string;
  emoji: string;
  kind: RoomKind;
  visibility: RoomVisibility;
  owner_id: number | null;
  group_id: number | null;
  last_message_at: number | null;
  archived: number;
  /** where an admin put it in the chat list (null: not placed; after the placed ones, by activity) */
  position: number | null;
  created_at: number;
}

interface MemberRow {
  room_id: number;
  user_id: number;
  role: MemberRole;
  last_read_id: number;
  notify: "all" | "mentions" | "none";
}

interface MessageRow {
  id: number;
  room_id: number;
  author_id: number | null;
  kind: "text" | "system";
  body_html: string;
  body_text: string;
  reply_to: number | null;
  pinned: number;
  deleted: number;
  created_at: number;
  edited_at: number | null;
}

export class ChatError extends UserError {}

export function room(id: number): RoomRow | null {
  return (db().prepare("select * from rooms where id = ?").get(id) as RoomRow | undefined) ?? null;
}

/** The site's first open room (the Lounge, made at setup): the default room until an admin picks one. */
export function firstOpenRoom(): RoomRow | null {
  return (db().prepare("select * from rooms where kind = 'room' and visibility = 'open' and archived = 0 order by id limit 1").get() as RoomRow | undefined) ?? null;
}

/**
 * The room /chat opens (Admin → Groups & chat rooms), if this member can open it: none when an admin
 * chose none, or the room is gone, archived or not theirs to see.
 */
export function defaultRoomFor(u: User): number | null {
  const pick = getSettings().defaultRoom;
  if (pick === 0) return null;
  const r = pick > 0 ? room(pick) : firstOpenRoom();
  return r && !r.archived && r.kind !== "dm" && canSee(u, r) ? r.id : null;
}

function member(roomId: number, userId: number): MemberRow | null {
  return (db().prepare("select * from room_members where room_id = ? and user_id = ?").get(roomId, userId) as MemberRow | undefined) ?? null;
}

export const isOpenRoom = (r: RoomRow) => r.kind === "room" && r.visibility === "open";

export function canSee(u: User, r: RoomRow): boolean {
  return isOpenRoom(r) || !!member(r.id, u.id);
}

export function canManage(u: User, r: RoomRow): boolean {
  if (r.kind === "dm") return false;
  const m = member(r.id, u.id);
  return m?.role === "owner" || m?.role === "admin" || u.isAdmin;
}

/** Who hears about a room's live events: its members, or everyone online for an open room. */
function audience(r: RoomRow): number[] | "all" {
  if (isOpenRoom(r)) return "all";
  return memberIds(r.id);
}

function emit(r: RoomRow, type: string, data: unknown) {
  const who = audience(r);
  if (who === "all") broadcast(type, data);
  else sendToMany(who, type, data);
}

export function memberIds(roomId: number): number[] {
  return (db().prepare("select user_id from room_members where room_id = ?").all(roomId) as { user_id: number }[]).map((r) => r.user_id);
}

export function scopeOf(r: RoomRow) {
  return `r:${r.id}`;
}

function unreadFor(roomId: number, userId: number): number {
  const m = member(roomId, userId);
  if (!m) return 0;
  return (
    db()
      .prepare("select count(*) n from messages where room_id = ? and id > ? and deleted = 0 and kind = 'text' and (author_id is null or author_id != ?)")
      .get(roomId, m.last_read_id, userId) as { n: number }
  ).n;
}

// ── rooms ──

export function roomInfo(u: User, r: RoomRow): RoomInfo {
  const m = member(r.id, u.id);
  const count = (db().prepare("select count(*) n from room_members where room_id = ?").get(r.id) as { n: number }).n;
  const last = db()
    .prepare("select m.body_text, m.kind, u.display_name from messages m left join users u on u.id = m.author_id where m.room_id = ? and m.deleted = 0 order by m.id desc limit 1")
    .get(r.id) as { body_text: string; kind: string; display_name: string | null } | undefined;
  let other: UserSummary | null = null;
  if (r.kind === "dm") {
    const o = db().prepare("select user_id from room_members where room_id = ? and user_id != ?").get(r.id, u.id) as { user_id: number } | undefined;
    other = o ? summaries([o.user_id]).get(o.user_id) ?? GHOST : GHOST;
  }
  const g = r.group_id ? (db().prepare("select slug from groups where id = ?").get(r.group_id) as { slug: string } | undefined) : undefined;
  const invited = !m && !!db().prepare("select 1 from room_invites where room_id = ? and user_id = ?").get(r.id, u.id);
  return {
    id: r.id,
    name: r.kind === "dm" && other ? other.name : r.name,
    topic: r.topic,
    emoji: r.emoji,
    kind: r.kind,
    visibility: r.visibility,
    groupId: r.group_id,
    groupSlug: g?.slug ?? null,
    memberCount: count,
    lastMessageAt: r.last_message_at,
    lastMessage: last ? { author: last.kind === "system" ? "" : last.display_name ?? "", text: last.body_text.slice(0, 120) } : null,
    myRole: m?.role ?? null,
    notify: m?.notify ?? "all",
    unread: m ? unreadFor(r.id, u.id) : 0,
    other,
    invited,
    archived: !!r.archived,
    position: r.kind === "dm" ? null : (r.position ?? null),
  };
}

/**
 * Your rooms and DMs, the open rooms you could join, and invitations. Rooms in the order an admin
 * gave them (the rest by their latest message), DMs newest first.
 */
export function roomsFor(u: User): { mine: RoomInfo[]; open: RoomInfo[]; invites: RoomInfo[] } {
  const mine = (db().prepare("select r.* from rooms r join room_members m on m.room_id = r.id where m.user_id = ? and r.archived = 0").all(u.id) as RoomRow[]).map((r) => roomInfo(u, r));
  mine.sort(byPlace);
  const open = (
    db().prepare("select * from rooms where kind = 'room' and visibility = 'open' and archived = 0 and id not in (select room_id from room_members where user_id = ?)").all(u.id) as RoomRow[]
  )
    .map((r) => roomInfo(u, r))
    .sort(byPlace);
  const invites = (db().prepare("select r.* from rooms r join room_invites i on i.room_id = r.id where i.user_id = ? and r.archived = 0").all(u.id) as RoomRow[]).map((r) => roomInfo(u, r));
  return { mine, open, invites };
}

export function members(roomId: number): RoomMember[] {
  const rows = db().prepare("select user_id, role from room_members where room_id = ? order by case role when 'owner' then 0 when 'admin' then 1 else 2 end, joined_at").all(roomId) as { user_id: number; role: MemberRole }[];
  const people = summaries(rows.map((r) => r.user_id));
  return rows.filter((r) => people.has(r.user_id)).map((r) => ({ user: people.get(r.user_id)!, role: r.role }));
}

/** How far each member has read (for "seen" marks). */
export function readMarks(roomId: number): { userId: number; lastId: number }[] {
  return (db().prepare("select user_id userId, last_read_id lastId from room_members where room_id = ?").all(roomId) as { userId: number; lastId: number }[]).filter((x) => x.lastId > 0);
}

function systemMessage(r: RoomRow, text: string) {
  const t = now();
  const id = Number(db().prepare("insert into messages (room_id, author_id, kind, body_html, body_text, created_at) values (?, null, 'system', ?, ?, ?)").run(r.id, textToHtml(text), text, t).lastInsertRowid);
  db().prepare("update rooms set last_message_at = ? where id = ?").run(t, r.id);
  emit(r, "msg", { room: r.id, message: toMessages([db().prepare("select * from messages where id = ?").get(id) as MessageRow], 0)[0] });
}

export function createRoom(u: User, o: { name: string; topic?: string; emoji?: string; visibility: RoomVisibility; invite?: number[] }): number {
  const name = cleanLine(o.name, 40);
  if (!name) throw new ChatError("Give the room a name.");
  const id = tx(() => {
    const t = now();
    const id = Number(
      db()
        .prepare("insert into rooms (name, topic, emoji, kind, visibility, owner_id, created_at, last_message_at) values (?, ?, ?, 'room', ?, ?, ?, ?)")
        .run(name, cleanLine(o.topic, 200), [...(o.emoji || "")].slice(0, 2).join(""), o.visibility === "private" ? "private" : "open", u.id, t, t).lastInsertRowid,
    );
    db().prepare("insert into room_members (room_id, user_id, role, joined_at) values (?, ?, 'owner', ?)").run(id, u.id, t);
    indexItem("room", id, o.visibility === "private" ? `r:${id}` : "members", u.id, t, name, o.topic || "");
    return id;
  });
  const r = room(id)!;
  systemMessage(r, serverT()("{name} made the room.", { name: u.name }));
  if (o.invite?.length) inviteToRoom(u, id, o.invite);
  if (isOpenRoom(r)) broadcast("rooms", { changed: id });
  return id;
}

export function updateRoom(u: User, id: number, o: { name?: string; topic?: string; emoji?: string; visibility?: RoomVisibility }) {
  const r = room(id);
  if (!r || !canManage(u, r)) throw new ChatError("Only the room's owner and admins can change it.");
  const name = o.name !== undefined ? cleanLine(o.name, 40) || r.name : r.name;
  const topic = o.topic !== undefined ? cleanLine(o.topic, 200) : r.topic;
  const emoji = o.emoji !== undefined ? [...o.emoji].slice(0, 2).join("") : r.emoji;
  const vis = r.kind === "room" && (o.visibility === "open" || o.visibility === "private") ? o.visibility : r.visibility;
  db().prepare("update rooms set name = ?, topic = ?, emoji = ?, visibility = ? where id = ?").run(name, topic, emoji, vis, id);
  indexItem("room", id, vis === "private" ? `r:${id}` : "members", r.owner_id, r.created_at, name, topic);
  const tr = serverT();
  const changes: string[] = [];
  if (name !== r.name) changes.push(tr("renamed the room to {name}", { name }));
  if (topic !== r.topic) changes.push(topic ? tr("set the topic: {topic}", { topic }) : tr("cleared the topic"));
  if (vis !== r.visibility) changes.push(vis === "private" ? tr("made the room private (invite only)") : tr("opened the room to everyone"));
  if (changes.length) systemMessage(room(id)!, `${u.name} ${changes.join(", ")}.`);
  broadcast("rooms", { changed: id });
}

/**
 * An admin's order for the chat list: these rooms first, in this order, for everyone (rooms not in
 * the list go after them, by their latest message). Direct messages aren't placed.
 */
export function arrangeRooms(u: User, ids: number[]) {
  if (!u.isAdmin) throw new ChatError("Only admins can arrange the chats.");
  const list = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
  tx(() => {
    const set = db().prepare("update rooms set position = ? where id = ? and kind != 'dm'");
    list.forEach((id, i) => set.run(i + 1, id));
  });
  broadcast("rooms", { arranged: true });
}

export function archiveRoom(u: User, id: number, archived: boolean) {
  const r = room(id);
  if (!r || !canManage(u, r)) throw new ChatError("Only the room's owner and admins can do that.");
  db().prepare("update rooms set archived = ? where id = ?").run(archived ? 1 : 0, id);
  broadcast("rooms", { changed: id });
}

export function deleteRoom(u: User, id: number) {
  const r = room(id);
  if (!r) return;
  const m = member(id, u.id);
  if (!(u.isAdmin || m?.role === "owner")) throw new ChatError("Only the room's owner can delete it.");
  const ids = memberIds(id);
  tx(() => {
    db().prepare("delete from search_index where scope = ?").run(`r:${id}`);
    unindex("room", id);
    db().prepare("delete from rooms where id = ?").run(id);
  });
  if (isOpenRoom(r)) broadcast("rooms", { changed: id, deleted: true });
  else sendToMany(ids, "rooms", { changed: id, deleted: true });
}

export function joinRoom(u: User, id: number) {
  const r = room(id);
  if (!r) throw new ChatError("That room is gone.");
  if (member(id, u.id)) return;
  const invited = db().prepare("select 1 from room_invites where room_id = ? and user_id = ?").get(id, u.id);
  if (!isOpenRoom(r) && !invited) throw new ChatError("This room is private: you need an invitation.");
  const last = (db().prepare("select coalesce(max(id), 0) m from messages where room_id = ?").get(id) as { m: number }).m;
  db().prepare("insert into room_members (room_id, user_id, role, joined_at, last_read_id) values (?, ?, 'member', ?, ?)").run(id, u.id, now(), last);
  db().prepare("delete from room_invites where room_id = ? and user_id = ?").run(id, u.id);
  systemMessage(r, serverT()("{name} joined.", { name: u.name }));
  sendTo(u.id, "rooms", { changed: id });
}

export function leaveRoom(u: User, id: number) {
  const r = room(id);
  if (!r || r.kind === "dm") return;
  const m = member(id, u.id);
  if (!m) return;
  db().prepare("delete from room_members where room_id = ? and user_id = ?").run(id, u.id);
  if (!isOpenRoom(r)) kickFromVoice(id, u.id);
  // the owner leaving hands the room to the longest-standing admin or member
  if (m.role === "owner") {
    const next = db().prepare("select user_id from room_members where room_id = ? order by case role when 'admin' then 0 else 1 end, joined_at limit 1").get(id) as { user_id: number } | undefined;
    if (next) db().prepare("update room_members set role = 'owner' where room_id = ? and user_id = ?").run(id, next.user_id);
  }
  systemMessage(r, serverT()("{name} left.", { name: u.name }));
  sendTo(u.id, "rooms", { changed: id });
}

export function inviteToRoom(u: User, id: number, userIds: number[]) {
  const r = room(id);
  if (!r || r.kind === "dm") throw new ChatError("You can't invite people here.");
  // a group's room has the group's members: invite them to the group instead
  if (r.kind === "group") throw new ChatError("This is a group's room: invite people to the group instead.");
  if (!member(id, u.id) && !u.isAdmin) throw new ChatError("Join the room first.");
  const already = new Set(memberIds(id));
  const t = now();
  const invited: number[] = [];
  for (const uid of new Set(userIds)) {
    if (already.has(uid) || uid === u.id) continue;
    db().prepare("insert or ignore into room_invites (room_id, user_id, invited_by, created_at) values (?, ?, ?, ?)").run(id, uid, u.id, t);
    invited.push(uid);
  }
  if (!invited.length) return 0;
  notify(invited, { kind: "invite", actorId: u.id, title: "{name} invited you to {room}", body: r.topic ? "{topic}" : "", vars: { name: u.name, room: `${r.emoji ? r.emoji + " " : ""}${r.name}`, topic: r.topic }, url: `/chat/${id}` });
  sendToMany(invited, "rooms", { changed: id });
  const names = [...summaries(invited).values()].map((s) => s.name);
  systemMessage(r, serverT()("{name} invited {names}.", { name: u.name, names: names.join(", ") }));
  return invited.length;
}

export function declineInvite(u: User, id: number) {
  db().prepare("delete from room_invites where room_id = ? and user_id = ?").run(id, u.id);
  sendTo(u.id, "rooms", { changed: id });
}

export function removeMember(u: User, id: number, userId: number) {
  const r = room(id);
  if (!r || !canManage(u, r)) throw new ChatError("Only the room's owner and admins can remove people.");
  const target = member(id, userId);
  if (!target || target.role === "owner") throw new ChatError("You can't remove the room's owner.");
  db().prepare("delete from room_members where room_id = ? and user_id = ?").run(id, userId);
  kickFromVoice(id, userId);
  const who = summaries([userId]).get(userId);
  const tr = serverT();
  systemMessage(r, tr("{name} removed {who}.", { name: u.name, who: who?.name ?? tr("someone") }));
  sendTo(userId, "rooms", { changed: id, removed: true });
}

export function setMemberRole(u: User, id: number, userId: number, role: MemberRole) {
  const r = room(id);
  if (!r || !canManage(u, r)) throw new ChatError("Only the room's owner and admins can do that.");
  const me = member(id, u.id);
  if (!["owner", "admin", "member"].includes(role)) throw new ChatError("No such role.");
  // the owner's own role is the owner's (or a site admin's) to change
  if (member(id, userId)?.role === "owner" && me?.role !== "owner" && !u.isAdmin) throw new ChatError("Only the owner can change that.");
  if (role === "owner") {
    if (me?.role !== "owner" && !u.isAdmin) throw new ChatError("Only the owner can hand the room over.");
    db().prepare("update room_members set role = 'admin' where room_id = ? and role = 'owner'").run(id);
  }
  db().prepare("update room_members set role = ? where room_id = ? and user_id = ?").run(role, id, userId);
  sendToMany(memberIds(id), "rooms", { changed: id });
}

export function setNotify(u: User, id: number, mode: "all" | "mentions" | "none") {
  db().prepare("update room_members set notify = ? where room_id = ? and user_id = ?").run(mode, id, u.id);
}

/** The direct-message room between two people (made the first time). */
export function dmRoom(u: User, otherId: number): number {
  if (otherId === u.id) throw new ChatError("That's you!");
  const found = db()
    .prepare(
      `select r.id from rooms r where r.kind = 'dm'
         and exists (select 1 from room_members where room_id = r.id and user_id = ?)
         and exists (select 1 from room_members where room_id = r.id and user_id = ?)`,
    )
    .get(u.id, otherId) as { id: number } | undefined;
  if (found) return found.id;
  const other = summaries([otherId]).get(otherId);
  if (!other) throw new ChatError("There's no one by that name.");
  return tx(() => {
    const t = now();
    const id = Number(db().prepare("insert into rooms (name, kind, visibility, owner_id, created_at) values (?, 'dm', 'private', ?, ?)").run(`${u.username}+${other.username}`, u.id, t).lastInsertRowid);
    db().prepare("insert into room_members (room_id, user_id, role, joined_at) values (?, ?, 'member', ?), (?, ?, 'member', ?)").run(id, u.id, t, id, otherId, t);
    return id;
  });
}

/** A group's own room: made with the group, its members kept in step with the group's. */
export function groupRoom(groupId: number, name: string, ownerId: number): number {
  const t = now();
  const id = Number(db().prepare("insert into rooms (name, topic, kind, visibility, owner_id, group_id, created_at, last_message_at) values (?, ?, 'group', 'private', ?, ?, ?, ?)").run(name, serverT()("The group's own chat"), ownerId, groupId, t, t).lastInsertRowid);
  db().prepare("insert or ignore into room_members (room_id, user_id, role, joined_at) values (?, ?, 'owner', ?)").run(id, ownerId, t);
  return id;
}

export function syncGroupMember(roomId: number | null, userId: number, inGroup: boolean) {
  if (!roomId) return;
  if (inGroup) {
    const last = (db().prepare("select coalesce(max(id), 0) m from messages where room_id = ?").get(roomId) as { m: number }).m;
    db().prepare("insert or ignore into room_members (room_id, user_id, role, joined_at, last_read_id) values (?, ?, 'member', ?, ?)").run(roomId, userId, now(), last);
  } else {
    db().prepare("delete from room_members where room_id = ? and user_id = ?").run(roomId, userId);
    kickFromVoice(roomId, userId);
  }
  sendTo(userId, "rooms", { changed: roomId });
}

// ── messages ──

function toMessages(rows: MessageRow[], me: number): ChatMessage[] {
  const authors = summaries(rows.map((r) => r.author_id!).filter(Boolean));
  const replyIds = rows.map((r) => r.reply_to!).filter(Boolean);
  const replies = new Map<number, { id: number; author: string; text: string; deleted: boolean }>();
  if (replyIds.length) {
    const rr = db()
      .prepare(`select m.id, m.body_text, m.deleted, u.display_name from messages m left join users u on u.id = m.author_id where m.id in (${replyIds.map(() => "?").join(",")})`)
      .all(...replyIds) as { id: number; body_text: string; deleted: number; display_name: string | null }[];
    for (const r of rr) replies.set(r.id, { id: r.id, author: r.display_name ?? "", text: r.deleted ? "" : r.body_text.slice(0, 140), deleted: !!r.deleted });
  }
  const reacts = reactionsFor("message", rows.map((r) => r.id), me);
  return rows.map((r) => ({
    id: r.id,
    room: r.room_id,
    author: r.author_id ? authors.get(r.author_id) ?? GHOST : null,
    kind: r.kind,
    html: r.deleted ? "" : r.body_html,
    createdAt: r.created_at,
    editedAt: r.edited_at,
    deleted: !!r.deleted,
    pinned: !!r.pinned,
    replyTo: r.reply_to ? replies.get(r.reply_to) ?? null : null,
    reactions: reacts.get(r.id) ?? [],
  }));
}

export function messages(u: User, roomId: number, o: { before?: number; around?: number; limit?: number } = {}): { messages: ChatMessage[]; more: boolean } {
  const r = room(roomId);
  if (!r || !canSee(u, r)) throw new ChatError("You can't see this room.");
  const limit = Math.min(o.limit ?? 50, 100);
  let rows: MessageRow[];
  if (o.around) {
    const older = db().prepare("select * from messages where room_id = ? and id <= ? order by id desc limit ?").all(roomId, o.around, 30) as MessageRow[];
    const newer = db().prepare("select * from messages where room_id = ? and id > ? order by id asc limit ?").all(roomId, o.around, 30) as MessageRow[];
    rows = [...older.reverse(), ...newer];
  } else {
    rows = (
      o.before
        ? db().prepare("select * from messages where room_id = ? and id < ? order by id desc limit ?").all(roomId, o.before, limit + 1)
        : db().prepare("select * from messages where room_id = ? order by id desc limit ?").all(roomId, limit + 1)
    ) as MessageRow[];
    const more = rows.length > limit;
    rows = rows.slice(0, limit).reverse();
    return { messages: toMessages(rows, u.id), more };
  }
  return { messages: toMessages(rows, u.id), more: true };
}

export function pinned(u: User, roomId: number): ChatMessage[] {
  const r = room(roomId);
  if (!r || !canSee(u, r)) return [];
  return toMessages(db().prepare("select * from messages where room_id = ? and pinned = 1 and deleted = 0 order by id desc").all(roomId) as MessageRow[], u.id);
}

export function sendMessage(u: User, roomId: number, html: string, replyTo?: number | null): ChatMessage {
  const r = room(roomId);
  if (!r || !canSee(u, r)) throw new ChatError("You can't write here.");
  if (r.archived) throw new ChatError("This room is archived.");
  const c = cleanHtml(html, { maxLength: 60_000 });
  if (c.empty) throw new ChatError("Write something first.");
  if (!member(roomId, u.id)) joinRoom(u, roomId);
  const reply = replyTo && db().prepare("select id from messages where id = ? and room_id = ?").get(replyTo, roomId) ? replyTo : null;
  const t = now();
  const id = Number(db().prepare("insert into messages (room_id, author_id, kind, body_html, body_text, reply_to, created_at) values (?, ?, 'text', ?, ?, ?, ?)").run(roomId, u.id, c.html, c.text, reply, t).lastInsertRowid);
  db().prepare("update rooms set last_message_at = ? where id = ?").run(t, roomId);
  db().prepare("update room_members set last_read_id = ? where room_id = ? and user_id = ?").run(id, roomId, u.id);
  indexItem("message", id, scopeOf(r), u.id, t, r.kind === "dm" ? serverT()("Direct message") : r.name, c.text);
  const msg = toMessages([db().prepare("select * from messages where id = ? ").get(id) as MessageRow], u.id)[0];
  emit(r, "msg", { room: roomId, message: { ...msg, reactions: [] } });

  // unread counts and pings for the others
  const ms = db().prepare("select * from room_members where room_id = ? and user_id != ?").all(roomId, u.id) as MemberRow[];
  const mentioned = new Set(c.mentions.map((name) => userByName(name)?.id).filter((x): x is number => !!x));
  // (English, with the member's words in vars: notify() writes it in each one's language)
  const title = r.kind === "dm" ? "{name}" : "{name} in {room}";
  const excerpt = c.text.slice(0, 180);
  const body = excerpt ? "{text}" : "📷 Picture";
  const vars = { name: u.name, room: `${r.emoji ? r.emoji + " " : ""}${r.name}`, text: excerpt };
  const url = `/chat/${roomId}`;
  for (const m of ms) {
    if (isInRoom(m.user_id, roomId)) continue;
    sendTo(m.user_id, "unread", { room: roomId, n: unreadFor(roomId, m.user_id) });
    if (mentioned.has(m.user_id)) continue;
    if (m.notify === "none" || m.notify === "mentions") continue;
    notify([m.user_id], { kind: r.kind === "dm" ? "dm" : "room", actorId: u.id, title, body, vars, url, pushOnly: true, tag: `room-${roomId}`, mailTitle: r.kind === "dm" ? "{name} sent you a message" : undefined });
  }
  // mentions: in the bell too (people who can see the room)
  const canRead = new Set(isOpenRoom(r) ? [...mentioned] : ms.map((m) => m.user_id).filter((id) => mentioned.has(id)));
  const pingable = [...canRead].filter((id) => !isInRoom(id, roomId) && ms.find((m) => m.user_id === id)?.notify !== "none");
  if (pingable.length) notify(pingable, { kind: "mention", actorId: u.id, title: r.kind === "dm" ? "{name} mentioned you in a message" : "{name} mentioned you in {room}", body, vars: { ...vars, room: r.name }, url: `${url}?m=${id}`, tag: `room-${roomId}` });
  return msg;
}

function ownMessage(u: User, id: number): { r: RoomRow; m: MessageRow } {
  const m = db().prepare("select * from messages where id = ?").get(id) as MessageRow | undefined;
  if (!m || m.deleted) throw new ChatError("That message is gone.");
  const r = room(m.room_id)!;
  if (!canSee(u, r)) throw new ChatError("You can't see that.");
  return { r, m };
}

export function editMessage(u: User, id: number, html: string): ChatMessage {
  const { r, m } = ownMessage(u, id);
  if (m.author_id !== u.id) throw new ChatError("You can only edit your own messages.");
  const c = cleanHtml(html, { maxLength: 60_000 });
  if (c.empty) throw new ChatError("Write something first (or delete the message).");
  db().prepare("update messages set body_html = ?, body_text = ?, edited_at = ? where id = ?").run(c.html, c.text, now(), id);
  indexItem("message", id, scopeOf(r), u.id, m.created_at, r.kind === "dm" ? serverT()("Direct message") : r.name, c.text);
  const msg = toMessages([db().prepare("select * from messages where id = ?").get(id) as MessageRow], u.id)[0];
  emit(r, "msgEdit", { room: r.id, message: { ...msg, reactions: undefined } });
  return msg;
}

export function deleteMessage(u: User, id: number) {
  const { r, m } = ownMessage(u, id);
  if (m.author_id !== u.id && !canManage(u, r) && !u.isMod) throw new ChatError("You can only delete your own messages.");
  db().prepare("update messages set deleted = 1, pinned = 0, body_html = '', body_text = '' where id = ?").run(id);
  clearReactions("message", id);
  unindex("message", id);
  emit(r, "msgDelete", { room: r.id, id });
}

export function pinMessage(u: User, id: number, on: boolean) {
  const { r } = ownMessage(u, id);
  if (!member(r.id, u.id) && !u.isMod) throw new ChatError("Join the room first.");
  db().prepare("update messages set pinned = ? where id = ?").run(on ? 1 : 0, id);
  emit(r, "msgPin", { room: r.id, id, pinned: on });
  if (on) systemMessage(r, serverT()("{name} pinned a message.", { name: u.name }));
}

export function reactToMessage(u: User, id: number, emoji: string) {
  const { r } = ownMessage(u, id);
  const res = toggleReaction(u.id, "message", id, emoji);
  emit(r, "msgReact", { room: r.id, id, reactions: reactionsRaw("message", id) });
  // a reaction to your message: a quiet ping (only the bell)
  const m = db().prepare("select author_id from messages where id = ?").get(id) as { author_id: number | null };
  if (res.added && m.author_id && m.author_id !== u.id && r.kind !== "room") {
    notify([m.author_id], { kind: "reaction", actorId: u.id, title: "{name} reacted {emoji} to your message", vars: { name: u.name, emoji }, url: `/chat/${r.id}?m=${id}` });
  }
  return res.reactions;
}

export function markRead(u: User, roomId: number, lastId?: number) {
  const m = member(roomId, u.id);
  if (!m) return;
  const max = (db().prepare("select coalesce(max(id), 0) m from messages where room_id = ?").get(roomId) as { m: number }).m;
  const to = Math.min(lastId ?? max, max);
  if (to <= m.last_read_id) return;
  db().prepare("update room_members set last_read_id = ? where room_id = ? and user_id = ?").run(to, roomId, u.id);
  sendTo(u.id, "unread", { room: roomId, n: unreadFor(roomId, u.id) });
  const r = room(roomId)!;
  if (r.kind !== "room" || memberIds(roomId).length <= 12) sendToMany(memberIds(roomId), "read", { room: roomId, user: u.id, lastId: to });
}

export function typing(u: User, roomId: number) {
  const r = room(roomId);
  if (!r || !canSee(u, r)) return;
  emit(r, "typing", { room: roomId, user: { id: u.id, name: u.name } });
}
