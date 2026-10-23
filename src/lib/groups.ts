import "server-only";
import { UserError } from "./errors";
import { db, now, tx } from "./db";
import { notify } from "./notify";
import { cleanHtml, cleanLine } from "./sanitize";
import { indexItem, unindex } from "./search";
import { groupRoom, syncGroupMember } from "./chat";
import { sendToMany } from "./hub";
import { summaries, type User } from "./users";
import type { UserSummary } from "./types";

/**
 * Groups: a corner of the site for some of you (a game group, the climbers, the book club), with its
 * own posts, events, polls, forum category and chat room.
 *   open    anyone can see it and join
 *   closed  anyone can see it; joining needs a yes from the group's admins; only members see inside
 *   secret  only members know it exists; you get in by invitation
 */

export type Privacy = "open" | "closed" | "secret";
export type GroupRole = "owner" | "admin" | "member";

export interface GroupRow {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  description_html: string;
  avatar: string | null;
  banner: string | null;
  color: string | null;
  privacy: Privacy;
  owner_id: number | null;
  room_id: number | null;
  created_at: number;
}

export interface GroupInfo {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  descriptionHtml: string;
  avatar: string | null;
  banner: string | null;
  color: string;
  privacy: Privacy;
  roomId: number | null;
  memberCount: number;
  createdAt: number;
  myRole: GroupRole | null;
  /** you asked to join (closed) or were invited */
  request: "request" | "invite" | null;
  canRead: boolean;
  canManage: boolean;
  members: UserSummary[];
}

export class GroupError extends UserError {}

export function groupRow(idOrSlug: number | string): GroupRow | null {
  const r = typeof idOrSlug === "number" ? db().prepare("select * from groups where id = ?").get(idOrSlug) : db().prepare("select * from groups where slug = ?").get(idOrSlug);
  return (r as GroupRow | undefined) ?? null;
}

export function groupRole(groupId: number, userId: number): GroupRole | null {
  const r = db().prepare("select role from group_members where group_id = ? and user_id = ?").get(groupId, userId) as { role: GroupRole } | undefined;
  return r?.role ?? null;
}

/** Groups whose insides someone may see: open ones and their own (moderators see all). */
export function readableGroupIds(u: User): number[] {
  if (u.isMod) return (db().prepare("select id from groups").all() as { id: number }[]).map((r) => r.id);
  return (db().prepare("select id from groups where privacy = 'open' or id in (select group_id from group_members where user_id = ?)").all(u.id) as { id: number }[]).map((r) => r.id);
}

/** SQL for "this row's group_id is nothing or a group you can read". */
export function groupFilter(u: User, col = "group_id"): { sql: string; params: number[] } {
  const ids = readableGroupIds(u);
  if (!ids.length) return { sql: `${col} is null`, params: [] };
  return { sql: `(${col} is null or ${col} in (${ids.map(() => "?").join(",")}))`, params: ids };
}

export function canReadGroup(u: User, g: GroupRow) {
  return g.privacy === "open" || u.isMod || !!groupRole(g.id, u.id);
}

export function canSeeGroup(u: User, g: GroupRow) {
  return g.privacy !== "secret" || u.isMod || !!groupRole(g.id, u.id) || !!db().prepare("select 1 from group_requests where group_id = ? and user_id = ? and kind = 'invite'").get(g.id, u.id);
}

export function canPostInGroup(u: User, g: GroupRow) {
  return !!groupRole(g.id, u.id) || u.isAdmin;
}

export function canManageGroup(u: User, g: GroupRow) {
  const r = groupRole(g.id, u.id);
  return r === "owner" || r === "admin" || u.isAdmin;
}

export function memberIdsOf(groupId: number): number[] {
  return (db().prepare("select user_id from group_members where group_id = ?").all(groupId) as { user_id: number }[]).map((r) => r.user_id);
}

export function groupInfo(u: User, g: GroupRow, withMembers = false): GroupInfo {
  const count = (db().prepare("select count(*) n from group_members where group_id = ?").get(g.id) as { n: number }).n;
  const req = db().prepare("select kind from group_requests where group_id = ? and user_id = ?").get(g.id, u.id) as { kind: "request" | "invite" } | undefined;
  let members: UserSummary[] = [];
  if (withMembers) {
    const ids = (db().prepare("select user_id from group_members where group_id = ? order by case role when 'owner' then 0 when 'admin' then 1 else 2 end, joined_at").all(g.id) as { user_id: number }[]).map((r) => r.user_id);
    const map = summaries(ids);
    members = ids.map((id) => map.get(id)!).filter(Boolean);
  }
  return {
    id: g.id,
    slug: g.slug,
    name: g.name,
    tagline: g.tagline,
    descriptionHtml: g.description_html,
    avatar: g.avatar,
    banner: g.banner,
    color: g.color || "#2f7088",
    privacy: g.privacy,
    roomId: g.room_id,
    memberCount: count,
    createdAt: g.created_at,
    myRole: groupRole(g.id, u.id),
    request: req?.kind ?? null,
    canRead: canReadGroup(u, g),
    canManage: canManageGroup(u, g),
    members,
  };
}

export function listGroups(u: User): { mine: GroupInfo[]; others: GroupInfo[] } {
  const rows = db().prepare("select * from groups order by name collate nocase").all() as GroupRow[];
  const visible = rows.filter((g) => canSeeGroup(u, g)).map((g) => groupInfo(u, g));
  return { mine: visible.filter((g) => g.myRole), others: visible.filter((g) => !g.myRole) };
}

/** Group roles for the member list. */
export function groupMembers(groupId: number): { user: UserSummary; role: GroupRole; joinedAt: number }[] {
  const rows = db().prepare("select user_id, role, joined_at from group_members where group_id = ? order by case role when 'owner' then 0 when 'admin' then 1 else 2 end, joined_at").all(groupId) as { user_id: number; role: GroupRole; joined_at: number }[];
  const map = summaries(rows.map((r) => r.user_id));
  return rows.filter((r) => map.has(r.user_id)).map((r) => ({ user: map.get(r.user_id)!, role: r.role, joinedAt: r.joined_at }));
}

export function groupRequests(groupId: number): { user: UserSummary; kind: "request" | "invite"; at: number }[] {
  const rows = db().prepare("select user_id, kind, created_at from group_requests where group_id = ? order by created_at").all(groupId) as { user_id: number; kind: "request" | "invite"; created_at: number }[];
  const map = summaries(rows.map((r) => r.user_id));
  return rows.filter((r) => map.has(r.user_id)).map((r) => ({ user: map.get(r.user_id)!, kind: r.kind, at: r.created_at }));
}

function slugify(name: string) {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "group";
  let slug = base;
  for (let i = 2; db().prepare("select 1 from groups where slug = ?").get(slug); i++) slug = `${base}-${i}`;
  return slug;
}

function scopeFor(g: Pick<GroupRow, "id" | "privacy">) {
  return g.privacy === "open" ? "members" : `g:${g.id}`;
}

export function createGroup(u: User, o: { name: string; tagline?: string; descriptionHtml?: string; privacy: Privacy; color?: string; avatar?: string | null; banner?: string | null; chat?: boolean }): GroupRow {
  const name = cleanLine(o.name, 50);
  if (!name) throw new GroupError("Give the group a name.");
  const desc = cleanHtml(o.descriptionHtml || "");
  const privacy: Privacy = ["open", "closed", "secret"].includes(o.privacy) ? o.privacy : "open";
  const g = tx(() => {
    const t = now();
    const id = Number(
      db()
        .prepare("insert into groups (slug, name, tagline, description_html, avatar, banner, color, privacy, owner_id, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(slugify(name), name, cleanLine(o.tagline, 120), desc.html, safeMedia(o.avatar), safeMedia(o.banner), /^#[0-9a-f]{6}$/i.test(o.color || "") ? o.color : null, privacy, u.id, t).lastInsertRowid,
    );
    db().prepare("insert into group_members (group_id, user_id, role, joined_at) values (?, ?, 'owner', ?)").run(id, u.id, t);
    if (o.chat !== false) {
      const room = groupRoom(id, name, u.id);
      db().prepare("update groups set room_id = ? where id = ?").run(room, id);
    }
    return groupRow(id)!;
  });
  indexItem("group", g.id, privacy === "secret" ? `g:${g.id}` : "members", u.id, g.created_at, g.name, `${g.tagline} ${desc.text}`);
  return g;
}

const safeMedia = (s?: string | null) => (s && /^\/media\/[\w./-]+$/.test(s) ? s : null);

export function updateGroup(u: User, id: number, o: { name?: string; tagline?: string; descriptionHtml?: string; privacy?: Privacy; color?: string; avatar?: string | null; banner?: string | null }) {
  const g = groupRow(id);
  if (!g || !canManageGroup(u, g)) throw new GroupError("Only the group's admins can change it.");
  const name = o.name !== undefined ? cleanLine(o.name, 50) || g.name : g.name;
  const desc = o.descriptionHtml !== undefined ? cleanHtml(o.descriptionHtml) : null;
  const privacy = o.privacy && ["open", "closed", "secret"].includes(o.privacy) ? o.privacy : g.privacy;
  db()
    .prepare("update groups set name = ?, tagline = ?, description_html = ?, privacy = ?, color = ?, avatar = ?, banner = ? where id = ?")
    .run(
      name,
      o.tagline !== undefined ? cleanLine(o.tagline, 120) : g.tagline,
      desc ? desc.html : g.description_html,
      privacy,
      o.color !== undefined ? (/^#[0-9a-f]{6}$/i.test(o.color) ? o.color : null) : g.color,
      o.avatar !== undefined ? safeMedia(o.avatar) : g.avatar,
      o.banner !== undefined ? safeMedia(o.banner) : g.banner,
      id,
    );
  if (g.room_id && name !== g.name) db().prepare("update rooms set name = ? where id = ?").run(name, g.room_id);
  // what's posted in the group follows its privacy in search (only the group's own things)
  if (privacy !== g.privacy) {
    const scope = scopeFor({ id, privacy });
    const up = db().prepare("update search_index set scope = ? where kind = ? and ref = ?");
    tx(() => {
      for (const [kind, ref] of groupSearchItems(id)) up.run(scope, kind, ref);
    });
  }
  const ng = groupRow(id)!;
  indexItem("group", id, privacy === "secret" ? `g:${id}` : "members", g.owner_id, g.created_at, ng.name, `${ng.tagline} ${desc?.text ?? ""}`);
}

/** Everything in the search index that belongs to a group: [kind, ref]. */
function groupSearchItems(id: number): [string, number][] {
  const q = (sql: string) => (db().prepare(sql).all(id) as { k: string; r: number }[]).map((x): [string, number] => [x.k, x.r]);
  return [
    ...q("select kind k, id r from posts where group_id = ?"),
    ...q("select 'poll' k, id r from polls where group_id = ?"),
    ...q("select 'event' k, id r from events where group_id = ?"),
    ...q("select 'thread' k, t.id r from forum_threads t join forum_categories c on c.id = t.category_id where c.group_id = ?"),
    ...q("select 'reply' k, p.id r from forum_posts p join forum_threads t on t.id = p.thread_id join forum_categories c on c.id = t.category_id where c.group_id = ?"),
    ...q("select 'comment' k, c.id r from comments c join posts p on c.target_type = 'post' and p.id = c.target_id where p.group_id = ?"),
    ...q("select 'comment' k, c.id r from comments c join polls p on c.target_type = 'poll' and p.id = c.target_id where p.group_id = ?"),
    ...q("select 'comment' k, c.id r from comments c join events e on c.target_type = 'event' and e.id = c.target_id where e.group_id = ?"),
  ];
}

export function deleteGroup(u: User, id: number) {
  const g = groupRow(id);
  if (!g) return;
  if (!(u.isAdmin || groupRole(id, u.id) === "owner")) throw new GroupError("Only the group's owner can delete it.");
  tx(() => {
    for (const [kind, ref] of groupSearchItems(id)) db().prepare("delete from search_index where kind = ? and ref = ?").run(kind, ref);
    unindex("group", id);
    if (g.room_id) db().prepare("delete from rooms where id = ?").run(g.room_id);
    db().prepare("delete from groups where id = ?").run(id);
  });
}

function addMember(g: GroupRow, userId: number, role: GroupRole = "member") {
  db().prepare("insert or ignore into group_members (group_id, user_id, role, joined_at) values (?, ?, ?, ?)").run(g.id, userId, role, now());
  db().prepare("delete from group_requests where group_id = ? and user_id = ?").run(g.id, userId);
  syncGroupMember(g.room_id, userId, true);
}

/** Join an open group, ask to join a closed one, or accept an invitation. */
export function joinGroup(u: User, id: number): "joined" | "requested" {
  const g = groupRow(id);
  if (!g || !canSeeGroup(u, g)) throw new GroupError("That group is gone.");
  if (groupRole(id, u.id)) return "joined";
  const vars = { name: u.name, group: g.name };
  const invited = db().prepare("select 1 from group_requests where group_id = ? and user_id = ? and kind = 'invite'").get(id, u.id);
  if (g.privacy === "open" || invited || u.isAdmin) {
    addMember(g, u.id);
    const admins = (db().prepare("select user_id from group_members where group_id = ? and role in ('owner','admin')").all(id) as { user_id: number }[]).map((r) => r.user_id);
    notify(admins, { kind: "group", actorId: u.id, title: "{name} joined {group}", vars, url: `/groups/${g.slug}` });
    return "joined";
  }
  if (g.privacy === "secret") throw new GroupError("This group is by invitation only.");
  db().prepare("insert or replace into group_requests (group_id, user_id, kind, by_id, created_at) values (?, ?, 'request', ?, ?)").run(id, u.id, u.id, now());
  const admins = (db().prepare("select user_id from group_members where group_id = ? and role in ('owner','admin')").all(id) as { user_id: number }[]).map((r) => r.user_id);
  notify(admins, { kind: "group", actorId: u.id, title: "{name} wants to join {group}", body: "Let them in on the group's Members tab.", vars, url: `/groups/${g.slug}/members` });
  return "requested";
}

export function cancelRequest(u: User, id: number) {
  db().prepare("delete from group_requests where group_id = ? and user_id = ?").run(id, u.id);
}

export function leaveGroup(u: User, id: number) {
  const g = groupRow(id);
  if (!g) return;
  const role = groupRole(id, u.id);
  if (!role) return;
  if (role === "owner") {
    const next = db().prepare("select user_id from group_members where group_id = ? and user_id != ? order by case role when 'admin' then 0 else 1 end, joined_at limit 1").get(id, u.id) as { user_id: number } | undefined;
    if (!next) throw new GroupError("You're the only member: delete the group instead.");
    db().prepare("update group_members set role = 'owner' where group_id = ? and user_id = ?").run(id, next.user_id);
    db().prepare("update groups set owner_id = ? where id = ?").run(next.user_id, id);
  }
  db().prepare("delete from group_members where group_id = ? and user_id = ?").run(id, u.id);
  syncGroupMember(g.room_id, u.id, false);
}

export function inviteToGroup(u: User, id: number, userIds: number[]) {
  const g = groupRow(id);
  if (!g || (!groupRole(id, u.id) && !u.isAdmin)) throw new GroupError("Join the group first.");
  if (g.privacy !== "open" && !canManageGroup(u, g)) throw new GroupError("Only the group's admins can invite people.");
  const t = now();
  const fresh: number[] = [];
  for (const uid of new Set(userIds)) {
    if (groupRole(id, uid)) continue;
    // someone who asked to join is simply let in
    const asked = db().prepare("select 1 from group_requests where group_id = ? and user_id = ? and kind = 'request'").get(id, uid);
    if (asked) {
      addMember(g, uid);
      notify([uid], { kind: "group", actorId: u.id, title: "You're in {group}!", vars: { group: g.name }, url: `/groups/${g.slug}` });
      continue;
    }
    db().prepare("insert or replace into group_requests (group_id, user_id, kind, by_id, created_at) values (?, ?, 'invite', ?, ?)").run(id, uid, u.id, t);
    fresh.push(uid);
  }
  notify(fresh, { kind: "invite", actorId: u.id, title: "{name} invited you to the group {group}", body: "{tagline}", vars: { name: u.name, group: g.name, tagline: g.tagline }, url: `/groups/${g.slug}` });
  return fresh.length;
}

export function answerRequest(u: User, id: number, userId: number, yes: boolean) {
  const g = groupRow(id);
  if (!g || !canManageGroup(u, g)) throw new GroupError("Only the group's admins can do that.");
  const req = db().prepare("select kind from group_requests where group_id = ? and user_id = ?").get(id, userId) as { kind: string } | undefined;
  if (!req) return;
  if (yes && req.kind === "request") {
    addMember(g, userId);
    notify([userId], { kind: "group", actorId: u.id, title: "You're in {group}!", vars: { group: g.name }, url: `/groups/${g.slug}` });
  } else db().prepare("delete from group_requests where group_id = ? and user_id = ?").run(id, userId);
}

export function removeFromGroup(u: User, id: number, userId: number) {
  const g = groupRow(id);
  if (!g || !canManageGroup(u, g)) throw new GroupError("Only the group's admins can do that.");
  if (groupRole(id, userId) === "owner") throw new GroupError("You can't remove the owner.");
  db().prepare("delete from group_members where group_id = ? and user_id = ?").run(id, userId);
  syncGroupMember(g.room_id, userId, false);
}

export function setGroupRole(u: User, id: number, userId: number, role: GroupRole) {
  const g = groupRow(id);
  if (!g || !canManageGroup(u, g)) throw new GroupError("Only the group's admins can do that.");
  if (!["owner", "admin", "member"].includes(role)) throw new GroupError("No such role.");
  // the owner's own role is the owner's (or a site admin's) to change
  if (groupRole(id, userId) === "owner" && groupRole(id, u.id) !== "owner" && !u.isAdmin) throw new GroupError("Only the owner can change that.");
  if (role === "owner") {
    if (groupRole(id, u.id) !== "owner" && !u.isAdmin) throw new GroupError("Only the owner can hand the group over.");
    db().prepare("update group_members set role = 'admin' where group_id = ? and role = 'owner'").run(id);
    db().prepare("update groups set owner_id = ? where id = ?").run(userId, id);
  }
  db().prepare("update group_members set role = ? where group_id = ? and user_id = ?").run(role, id, userId);
  if (g.room_id) db().prepare("update room_members set role = ? where room_id = ? and user_id = ?").run(role === "owner" ? "owner" : role === "admin" ? "admin" : "member", g.room_id, userId);
  sendToMany([userId], "refresh", {});
}

export function groupScope(groupId: number | null): string {
  if (!groupId) return "members";
  const g = groupRow(groupId);
  return g ? scopeFor(g) : "members";
}

/** The groups someone can post into (for the "post in" choice). */
export function postableGroups(u: User): { id: number; name: string; slug: string }[] {
  return db().prepare("select g.id, g.name, g.slug from groups g join group_members m on m.group_id = g.id where m.user_id = ? order by g.name collate nocase").all(u.id) as { id: number; name: string; slug: string }[];
}
