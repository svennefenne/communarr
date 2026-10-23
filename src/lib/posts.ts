import "server-only";
import { UserError } from "./errors";
import { db, now } from "./db";
import { notify } from "./notify";
import { reactionsFor, clearReactions } from "./reactions";
import { cleanHtml, cleanLine } from "./sanitize";
import { indexItem, unindex } from "./search";
import { canPostInGroup, canReadGroup, groupFilter, groupRow, groupScope, memberIdsOf, canManageGroup } from "./groups";
import { GHOST, summaries, userByName, usersWho, type User } from "./users";
import { getSettings } from "./settings";
import { sendTo, broadcast } from "./hub";
import type { GroupRef, PostView } from "./contentTypes";

export interface PostRow {
  id: number;
  author_id: number;
  kind: "post" | "news";
  title: string;
  body_html: string;
  body_text: string;
  cover: string | null;
  visibility: "members" | "private";
  group_id: number | null;
  pinned: number;
  comments_locked: number;
  created_at: number;
  edited_at: number | null;
}

export class PostError extends UserError {}

export function groupRefs(ids: (number | null)[]): Map<number, GroupRef> {
  const list = [...new Set(ids.filter((x): x is number => !!x))];
  const out = new Map<number, GroupRef>();
  if (!list.length) return out;
  const rows = db().prepare(`select id, slug, name, color from groups where id in (${list.map(() => "?").join(",")})`).all(...list) as { id: number; slug: string; name: string; color: string | null }[];
  for (const r of rows) out.set(r.id, { id: r.id, slug: r.slug, name: r.name, color: r.color || "#2f7088" });
  return out;
}

export function commentCounts(type: string, ids: number[]): Map<number, number> {
  const out = new Map<number, number>();
  if (!ids.length) return out;
  const rows = db().prepare(`select target_id id, count(*) n from comments where target_type = ? and target_id in (${ids.map(() => "?").join(",")}) group by target_id`).all(type, ...ids) as { id: number; n: number }[];
  for (const r of rows) out.set(r.id, r.n);
  return out;
}

export function toPostViews(u: User, rows: PostRow[]): PostView[] {
  const ids = rows.map((r) => r.id);
  const authors = summaries(rows.map((r) => r.author_id));
  const groups = groupRefs(rows.map((r) => r.group_id));
  const reacts = reactionsFor("post", ids, u.id);
  const counts = commentCounts("post", ids);
  const saved = new Set(
    ids.length ? (db().prepare(`select target_id from bookmarks where user_id = ? and target_type = 'post' and target_id in (${ids.map(() => "?").join(",")})`).all(u.id, ...ids) as { target_id: number }[]).map((r) => r.target_id) : [],
  );
  return rows.map((r) => {
    const g = r.group_id ? groupRow(r.group_id) : null;
    const groupMod = !!g && canManageGroup(u, g);
    return {
      id: r.id,
      kind: r.kind,
      title: r.title,
      html: r.body_html,
      author: authors.get(r.author_id) ?? GHOST,
      group: r.group_id ? groups.get(r.group_id) ?? null : null,
      visibility: r.visibility,
      pinned: !!r.pinned,
      commentsLocked: !!r.comments_locked,
      cover: r.cover,
      createdAt: r.created_at,
      editedAt: r.edited_at,
      comments: counts.get(r.id) ?? 0,
      reactions: reacts.get(r.id) ?? [],
      saved: saved.has(r.id),
      canEdit: r.author_id === u.id,
      canModerate: u.isMod || groupMod,
    };
  });
}

/** Can this member see this post? */
export function canSeePost(u: User, r: PostRow): boolean {
  if (r.visibility === "private" && r.author_id !== u.id) return false;
  if (r.group_id) {
    const g = groupRow(r.group_id);
    if (!g || !canReadGroup(u, g)) return false;
  }
  return true;
}

export function postRow(id: number): PostRow | null {
  return (db().prepare("select * from posts where id = ?").get(id) as PostRow | undefined) ?? null;
}

export function getPost(u: User, id: number): PostView | null {
  const r = postRow(id);
  if (!r || !canSeePost(u, r)) return null;
  return toPostViews(u, [r])[0];
}

export function listPosts(u: User, o: { kind?: "post" | "news"; groupId?: number; authorId?: number; before?: number; limit?: number; includePrivate?: boolean; pinnedFirst?: boolean } = {}): PostView[] {
  const gf = groupFilter(u);
  const where: string[] = [gf.sql];
  const params: unknown[] = [...gf.params];
  // your "only me" posts show on your own pages, not in the feeds
  if (o.includePrivate) {
    where.push("(visibility = 'members' or author_id = ?)");
    params.push(u.id);
  } else where.push("visibility = 'members'");
  if (o.kind) {
    where.push("kind = ?");
    params.push(o.kind);
  }
  if (o.groupId) {
    where.push("group_id = ?");
    params.push(o.groupId);
  }
  if (o.authorId) {
    where.push("author_id = ?");
    params.push(o.authorId);
  }
  if (o.before) {
    where.push("created_at < ?");
    params.push(o.before);
  }
  const rows = db()
    .prepare(`select * from posts where ${where.join(" and ")} order by ${o.pinnedFirst ? "pinned desc," : ""} created_at desc limit ?`)
    .all(...params, o.limit ?? 20) as PostRow[];
  return toPostViews(u, rows);
}

function scopeOf(r: Pick<PostRow, "visibility" | "group_id" | "author_id">) {
  if (r.visibility === "private") return `u:${r.author_id}`;
  return groupScope(r.group_id);
}

function mentionPeople(names: string[], exclude: number[]): number[] {
  return names.map((n) => userByName(n)?.id).filter((id): id is number => !!id && !exclude.includes(id));
}

export interface PostInput {
  title?: string;
  html: string;
  kind?: "post" | "news";
  groupId?: number | null;
  visibility?: "members" | "private";
  cover?: string | null;
  pinned?: boolean;
  notifyAll?: boolean;
}

export function createPost(u: User, o: PostInput): number {
  const kind = o.kind === "news" ? "news" : "post";
  if (kind === "news" && !u.isMod) throw new PostError("Only admins and moderators can post news.");
  const c = cleanHtml(o.html);
  if (c.empty) throw new PostError("Write something first.");
  const title = cleanLine(o.title, 140);
  if (kind === "news" && !title) throw new PostError("News needs a headline.");
  let groupId: number | null = null;
  if (o.groupId) {
    const g = groupRow(o.groupId);
    if (!g || !canPostInGroup(u, g)) throw new PostError("You can only post in groups you're in.");
    groupId = g.id;
  }
  const visibility = o.visibility === "private" && !groupId && kind === "post" ? "private" : "members";
  const cover = o.cover && /^\/media\/[\w./-]+$/.test(o.cover) ? o.cover : null;
  const t = now();
  const id = Number(
    db()
      .prepare("insert into posts (author_id, kind, title, body_html, body_text, cover, visibility, group_id, pinned, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(u.id, kind, title, c.html, c.text, cover, visibility, groupId, o.pinned && u.isMod ? 1 : 0, t).lastInsertRowid,
  );
  indexItem(kind, id, scopeOf({ visibility, group_id: groupId, author_id: u.id }), u.id, t, title || c.text.slice(0, 80), c.text);
  if (visibility === "private") return id;

  const url = `/posts/${id}`;
  const row = postRow(id)!;
  const mentioned = usersWho(mentionPeople(c.mentions, [u.id]), (x) => canSeePost(x, row));
  const preview = title || c.text.slice(0, 140);
  if (mentioned.length) notify(mentioned, { kind: "mention", actorId: u.id, title: `${u.name} mentioned you in a post`, body: preview, url });
  if (kind === "news" && o.notifyAll !== false) {
    const all = (db().prepare("select id from users where banned = 0").all() as { id: number }[]).map((r) => r.id);
    notify(all.filter((x) => !mentioned.includes(x)), { kind: "news", actorId: u.id, title: `📣 ${title}`, body: c.text.slice(0, 160), url });
  } else if (groupId) {
    const g = groupRow(groupId)!;
    notify(memberIdsOf(groupId).filter((x) => !mentioned.includes(x)), { kind: "group", actorId: u.id, title: `${u.name} posted in ${g.name}`, body: preview, url });
  }
  broadcast("feed", { type: kind, id, by: u.id, group: groupId });
  return id;
}

export function updatePost(u: User, id: number, o: PostInput) {
  const r = postRow(id);
  if (!r) throw new PostError("That post is gone.");
  if (r.author_id !== u.id && !(r.kind === "news" && u.isAdmin)) throw new PostError("You can only edit your own posts.");
  const c = cleanHtml(o.html);
  if (c.empty) throw new PostError("Write something first.");
  const title = cleanLine(o.title ?? r.title, 140);
  if (r.kind === "news" && !title) throw new PostError("News needs a headline.");
  const visibility = r.group_id || r.kind === "news" ? "members" : o.visibility === "private" ? "private" : o.visibility === "members" ? "members" : r.visibility;
  const cover = o.cover === undefined ? r.cover : o.cover && /^\/media\/[\w./-]+$/.test(o.cover) ? o.cover : null;
  db().prepare("update posts set title = ?, body_html = ?, body_text = ?, cover = ?, visibility = ?, edited_at = ? where id = ?").run(title, c.html, c.text, cover, visibility, now(), id);
  indexItem(r.kind, id, scopeOf({ visibility, group_id: r.group_id, author_id: r.author_id }), r.author_id, r.created_at, title || c.text.slice(0, 80), c.text);
  // newly mentioned people hear about it
  const before = new Set([...r.body_html.matchAll(/data-type="mention"[^>]*data-id="([^"]+)"/g)].map((m) => m[1]));
  const after = postRow(id)!;
  const fresh = usersWho(mentionPeople(c.mentions.filter((m) => !before.has(m)), [u.id]), (x) => canSeePost(x, after));
  if (fresh.length && visibility !== "private") notify(fresh, { kind: "mention", actorId: u.id, title: `${u.name} mentioned you in a post`, body: title || c.text.slice(0, 140), url: `/posts/${id}` });
}

export function deletePost(u: User, id: number) {
  const r = postRow(id);
  if (!r) return;
  const g = r.group_id ? groupRow(r.group_id) : null;
  if (r.author_id !== u.id && !u.isMod && !(g && canManageGroup(u, g))) throw new PostError("You can only delete your own posts.");
  db().prepare("delete from posts where id = ?").run(id);
  db().prepare("delete from comments where target_type = 'post' and target_id = ?").run(id);
  db().prepare("delete from bookmarks where target_type = 'post' and target_id = ?").run(id);
  clearReactions("post", id);
  unindex(r.kind, id);
}

export function pinPost(u: User, id: number, on: boolean) {
  const r = postRow(id);
  if (!r) return;
  const g = r.group_id ? groupRow(r.group_id) : null;
  if (!u.isMod && !(g && canManageGroup(u, g))) throw new PostError("Only moderators can pin posts.");
  db().prepare("update posts set pinned = ? where id = ?").run(on ? 1 : 0, id);
}

export function lockComments(u: User, id: number, on: boolean) {
  const r = postRow(id);
  if (!r) return;
  if (r.author_id !== u.id && !u.isMod) throw new PostError("Only the author and moderators can do that.");
  db().prepare("update posts set comments_locked = ? where id = ?").run(on ? 1 : 0, id);
}

export type BookmarkType = "post" | "thread" | "poll" | "event";

export function toggleBookmark(u: User, type: BookmarkType, id: number): boolean {
  const has = db().prepare("select 1 from bookmarks where user_id = ? and target_type = ? and target_id = ?").get(u.id, type, id);
  if (has) db().prepare("delete from bookmarks where user_id = ? and target_type = ? and target_id = ?").run(u.id, type, id);
  else db().prepare("insert into bookmarks (user_id, target_type, target_id, created_at) values (?, ?, ?, ?)").run(u.id, type, id, now());
  sendTo(u.id, "saved", { type, id, on: !has });
  return !has;
}

/** The news strip on the front page: pinned news first, then the latest. */
export function latestNews(u: User, limit = 3): PostView[] {
  if (!getSettings().features.news) return [];
  return listPosts(u, { kind: "news", limit, pinnedFirst: true });
}
