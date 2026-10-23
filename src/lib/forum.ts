import "server-only";
import { UserError } from "./errors";
import { db, now, tx } from "./db";
import { notify } from "./notify";
import { reactionsFor, clearReactions } from "./reactions";
import { cleanHtml, cleanLine } from "./sanitize";
import { indexItem, unindex } from "./search";
import { canPostInGroup, canReadGroup, groupRow, groupScope, readableGroupIds } from "./groups";
import { GHOST, summaries, userByName, usersWho, type User } from "./users";
import { broadcast } from "./hub";
import { groupRefs } from "./posts";
import type { CategoryView, ThreadCard } from "./contentTypes";
import type { Reaction, UserSummary } from "./types";

export interface CategoryRow {
  id: number;
  slug: string;
  name: string;
  description: string;
  color: string | null;
  icon: string;
  position: number;
  locked: number;
  group_id: number | null;
  created_at: number;
}

export interface ThreadRow {
  id: number;
  category_id: number;
  author_id: number;
  title: string;
  body_html: string;
  body_text: string;
  pinned: number;
  locked: number;
  reply_count: number;
  view_count: number;
  last_post_at: number;
  last_post_by: number | null;
  created_at: number;
  edited_at: number | null;
}

interface ReplyRow {
  id: number;
  thread_id: number;
  author_id: number;
  body_html: string;
  body_text: string;
  created_at: number;
  edited_at: number | null;
}

export interface ReplyView {
  id: number;
  author: UserSummary;
  html: string;
  createdAt: number;
  editedAt: number | null;
  reactions: Reaction[];
  canEdit: boolean;
  canDelete: boolean;
  /** this member's post count (shown by their name, forum style) */
  authorPosts: number;
}

export class ForumError extends UserError {}

export const PAGE_SIZE = 20;

function slugify(name: string) {
  const base = name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "category";
  let slug = base;
  for (let i = 2; db().prepare("select 1 from forum_categories where slug = ?").get(slug); i++) slug = `${base}-${i}`;
  return slug;
}

export function categoryRow(idOrSlug: number | string): CategoryRow | null {
  const r = typeof idOrSlug === "number" ? db().prepare("select * from forum_categories where id = ?").get(idOrSlug) : db().prepare("select * from forum_categories where slug = ?").get(idOrSlug);
  return (r as CategoryRow | undefined) ?? null;
}

export function canSeeCategory(u: User, c: CategoryRow) {
  if (!c.group_id) return true;
  const g = groupRow(c.group_id);
  return !!g && canReadGroup(u, g);
}

function visibleCategoryIds(u: User): number[] {
  const groups = readableGroupIds(u);
  return (db().prepare("select id, group_id from forum_categories").all() as { id: number; group_id: number | null }[]).filter((c) => !c.group_id || groups.includes(c.group_id)).map((c) => c.id);
}

export function categories(u: User, o: { groupId?: number } = {}): CategoryView[] {
  const rows = (db().prepare(`select * from forum_categories ${o.groupId ? "where group_id = ?" : ""} order by position, name`).all(...(o.groupId ? [o.groupId] : [])) as CategoryRow[]).filter((c) => canSeeCategory(u, c));
  const groups = groupRefs(rows.map((r) => r.group_id));
  return rows.map((c) => {
    const s = db().prepare("select count(*) threads, coalesce(sum(reply_count), 0) + count(*) posts from forum_threads where category_id = ?").get(c.id) as { threads: number; posts: number };
    const last = db().prepare("select id, title, last_post_at, last_post_by from forum_threads where category_id = ? order by last_post_at desc limit 1").get(c.id) as { id: number; title: string; last_post_at: number; last_post_by: number | null } | undefined;
    const unread = (
      db()
        .prepare("select count(*) n from forum_threads t left join forum_reads r on r.thread_id = t.id and r.user_id = ? where t.category_id = ? and (r.read_at is null or r.read_at < t.last_post_at) and t.last_post_by != ?")
        .get(u.id, c.id, u.id) as { n: number }
    ).n;
    const by = last?.last_post_by ? summaries([last.last_post_by]).get(last.last_post_by) ?? null : null;
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      color: c.color || "#2f7088",
      icon: c.icon,
      locked: !!c.locked,
      group: c.group_id ? groups.get(c.group_id) ?? null : null,
      threads: s.threads,
      posts: s.posts,
      last: last ? { threadId: last.id, title: last.title, at: last.last_post_at, by } : null,
      unread,
    };
  });
}

export function toThreadCards(u: User, rows: ThreadRow[]): ThreadCard[] {
  if (!rows.length) return [];
  const cats = new Map((db().prepare(`select * from forum_categories where id in (${[...new Set(rows.map((r) => r.category_id))].join(",")})`).all() as CategoryRow[]).map((c) => [c.id, c]));
  const people = summaries([...rows.map((r) => r.author_id), ...rows.map((r) => r.last_post_by!).filter(Boolean)]);
  const ids = rows.map((r) => r.id);
  const reads = new Map((db().prepare(`select thread_id, read_at from forum_reads where user_id = ? and thread_id in (${ids.map(() => "?").join(",")})`).all(u.id, ...ids) as { thread_id: number; read_at: number }[]).map((r) => [r.thread_id, r.read_at]));
  const reacts = reactionsFor("thread", ids, u.id);
  const groups = groupRefs([...cats.values()].map((c) => c.group_id));
  return rows.map((r) => {
    const c = cats.get(r.category_id)!;
    const read = reads.get(r.id);
    return {
      id: r.id,
      title: r.title,
      excerpt: r.body_text.slice(0, 220),
      category: { id: c.id, slug: c.slug, name: c.name, color: c.color || "#2f7088", icon: c.icon },
      author: people.get(r.author_id) ?? GHOST,
      replies: r.reply_count,
      views: r.view_count,
      lastPostAt: r.last_post_at,
      lastBy: r.last_post_by ? people.get(r.last_post_by) ?? null : null,
      pinned: !!r.pinned,
      locked: !!r.locked,
      unread: r.last_post_by !== u.id && (read == null || read < r.last_post_at),
      createdAt: r.created_at,
      reactions: reacts.get(r.id) ?? [],
      group: c.group_id ? groups.get(c.group_id) ?? null : null,
    };
  });
}

export function threads(u: User, o: { categoryId?: number; sort?: "active" | "new" | "top"; page?: number; authorId?: number; limit?: number; before?: number } = {}): { list: ThreadCard[]; total: number } {
  const cats = o.categoryId ? [o.categoryId] : visibleCategoryIds(u);
  if (!cats.length) return { list: [], total: 0 };
  const where = [`category_id in (${cats.map(() => "?").join(",")})`];
  const params: unknown[] = [...cats];
  if (o.authorId) {
    where.push("author_id = ?");
    params.push(o.authorId);
  }
  if (o.before) {
    where.push("created_at < ?");
    params.push(o.before);
  }
  const order = o.sort === "new" ? "created_at desc" : o.sort === "top" ? "reply_count desc, view_count desc" : "last_post_at desc";
  const limit = o.limit ?? PAGE_SIZE;
  const total = (db().prepare(`select count(*) n from forum_threads where ${where.join(" and ")}`).get(...params) as { n: number }).n;
  const rows = db()
    .prepare(`select * from forum_threads where ${where.join(" and ")} order by ${o.categoryId ? "pinned desc," : ""} ${order} limit ? offset ?`)
    .all(...params, limit, ((o.page ?? 1) - 1) * limit) as ThreadRow[];
  return { list: toThreadCards(u, rows), total };
}

export function threadRow(id: number): ThreadRow | null {
  return (db().prepare("select * from forum_threads where id = ?").get(id) as ThreadRow | undefined) ?? null;
}

export function canSeeThread(u: User, t: ThreadRow) {
  const c = categoryRow(t.category_id);
  return !!c && canSeeCategory(u, c);
}

function postCounts(ids: number[]): Map<number, number> {
  const out = new Map<number, number>();
  if (!ids.length) return out;
  const q = ids.map(() => "?").join(",");
  const a = db().prepare(`select author_id id, count(*) n from forum_threads where author_id in (${q}) group by author_id`).all(...ids) as { id: number; n: number }[];
  const b = db().prepare(`select author_id id, count(*) n from forum_posts where author_id in (${q}) group by author_id`).all(...ids) as { id: number; n: number }[];
  for (const r of [...a, ...b]) out.set(r.id, (out.get(r.id) ?? 0) + r.n);
  return out;
}

/** A thread: its opening post (as a reply-like view), a page of replies, and whether you follow it. */
export function threadPage(u: User, id: number, page = 1) {
  const t = threadRow(id);
  if (!t || !canSeeThread(u, t)) return null;
  const c = categoryRow(t.category_id)!;
  const total = t.reply_count;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const p = Math.min(Math.max(1, page), pages);
  const rows = db().prepare("select * from forum_posts where thread_id = ? order by created_at, id limit ? offset ?").all(id, PAGE_SIZE, (p - 1) * PAGE_SIZE) as ReplyRow[];
  const people = summaries([t.author_id, ...rows.map((r) => r.author_id)]);
  const counts = postCounts([t.author_id, ...rows.map((r) => r.author_id)]);
  const reacts = reactionsFor("reply", rows.map((r) => r.id), u.id);
  const opening: ReplyView = {
    id: 0,
    author: people.get(t.author_id) ?? GHOST,
    html: t.body_html,
    createdAt: t.created_at,
    editedAt: t.edited_at,
    reactions: reactionsFor("thread", [t.id], u.id).get(t.id) ?? [],
    canEdit: t.author_id === u.id,
    canDelete: u.isMod || (t.author_id === u.id && t.reply_count === 0),
    authorPosts: counts.get(t.author_id) ?? 0,
  };
  const replies: ReplyView[] = rows.map((r) => ({
    id: r.id,
    author: people.get(r.author_id) ?? GHOST,
    html: r.body_html,
    createdAt: r.created_at,
    editedAt: r.edited_at,
    reactions: reacts.get(r.id) ?? [],
    canEdit: r.author_id === u.id,
    canDelete: r.author_id === u.id || u.isMod,
    authorPosts: counts.get(r.author_id) ?? 0,
  }));
  const following = !!db().prepare("select 1 from forum_subs where thread_id = ? and user_id = ?").get(id, u.id);
  const saved = !!db().prepare("select 1 from bookmarks where user_id = ? and target_type = 'thread' and target_id = ?").get(u.id, id);
  const lastRead = (db().prepare("select read_at from forum_reads where thread_id = ? and user_id = ?").get(id, u.id) as { read_at: number } | undefined)?.read_at ?? 0;
  return {
    thread: toThreadCards(u, [t])[0],
    category: { id: c.id, slug: c.slug, name: c.name, color: c.color || "#2f7088", icon: c.icon },
    opening,
    replies,
    page: p,
    pages,
    following,
    saved,
    lastRead,
    canReply: !t.locked || u.isMod,
    canModerate: u.isMod,
  };
}

/** The page a reply is on. */
export function pageOfReply(threadId: number, replyId: number): number {
  const r = db().prepare("select created_at, id from forum_posts where id = ? and thread_id = ?").get(replyId, threadId) as { created_at: number; id: number } | undefined;
  if (!r) return 1;
  const before = (db().prepare("select count(*) n from forum_posts where thread_id = ? and (created_at < ? or (created_at = ? and id < ?))").get(threadId, r.created_at, r.created_at, r.id) as { n: number }).n;
  return Math.floor(before / PAGE_SIZE) + 1;
}

export function markThreadRead(u: User, id: number) {
  db().prepare("insert into forum_reads (thread_id, user_id, read_at) values (?, ?, ?) on conflict(thread_id, user_id) do update set read_at = excluded.read_at").run(id, u.id, now());
}

export function countView(id: number) {
  db().prepare("update forum_threads set view_count = view_count + 1 where id = ?").run(id);
}

function threadScope(c: CategoryRow) {
  return groupScope(c.group_id);
}

export function createThread(u: User, o: { categoryId: number; title: string; html: string }): number {
  const c = categoryRow(o.categoryId);
  if (!c || !canSeeCategory(u, c)) throw new ForumError("Pick a category.");
  if (c.locked && !u.isMod) throw new ForumError("Only moderators can start threads here.");
  if (c.group_id) {
    const g = groupRow(c.group_id);
    if (!g || !canPostInGroup(u, g)) throw new ForumError("Join the group to start a thread here.");
  }
  const title = cleanLine(o.title, 160);
  if (!title) throw new ForumError("Give the thread a title.");
  const b = cleanHtml(o.html);
  if (b.empty) throw new ForumError("Write something first.");
  const t = now();
  const id = tx(() => {
    const id = Number(
      db()
        .prepare("insert into forum_threads (category_id, author_id, title, body_html, body_text, last_post_at, last_post_by, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(c.id, u.id, title, b.html, b.text, t, u.id, t).lastInsertRowid,
    );
    db().prepare("insert into forum_subs (thread_id, user_id) values (?, ?)").run(id, u.id);
    db().prepare("insert into forum_reads (thread_id, user_id, read_at) values (?, ?, ?)").run(id, u.id, t);
    indexItem("thread", id, threadScope(c), u.id, t, title, b.text);
    return id;
  });
  const mentioned = usersWho(b.mentions.map((n) => userByName(n)?.id).filter((x): x is number => !!x), (x) => canSeeCategory(x, c));
  notify(mentioned, { kind: "mention", actorId: u.id, title: `${u.name} mentioned you in the forum`, body: title, url: `/forum/t/${id}` });
  broadcast("feed", { type: "thread", id, by: u.id, group: c.group_id });
  return id;
}

export function reply(u: User, threadId: number, html: string): number {
  const t = threadRow(threadId);
  if (!t || !canSeeThread(u, t)) throw new ForumError("That thread is gone.");
  if (t.locked && !u.isMod) throw new ForumError("This thread is locked.");
  const c = categoryRow(t.category_id)!;
  if (c.group_id) {
    const g = groupRow(c.group_id);
    if (!g || !canPostInGroup(u, g)) throw new ForumError("Join the group to reply here.");
  }
  const b = cleanHtml(html);
  if (b.empty) throw new ForumError("Write something first.");
  const ts = now();
  const id = tx(() => {
    const id = Number(db().prepare("insert into forum_posts (thread_id, author_id, body_html, body_text, created_at) values (?, ?, ?, ?, ?)").run(threadId, u.id, b.html, b.text, ts).lastInsertRowid);
    db().prepare("update forum_threads set reply_count = reply_count + 1, last_post_at = ?, last_post_by = ? where id = ?").run(ts, u.id, threadId);
    db().prepare("insert or ignore into forum_subs (thread_id, user_id) values (?, ?)").run(threadId, u.id);
    db().prepare("insert into forum_reads (thread_id, user_id, read_at) values (?, ?, ?) on conflict(thread_id, user_id) do update set read_at = excluded.read_at").run(threadId, u.id, ts);
    indexItem("reply", id, threadScope(c), u.id, ts, t.title, b.text);
    return id;
  });
  const url = `/go/reply/${id}`;
  const mentioned = usersWho(b.mentions.map((n) => userByName(n)?.id).filter((x): x is number => !!x), (x) => canSeeThread(x, t));
  if (mentioned.length) notify(mentioned, { kind: "mention", actorId: u.id, title: `${u.name} mentioned you in “${t.title}”`, body: b.text.slice(0, 160), url });
  // (followers who left the group, or never could see it, hear nothing)
  const subs = usersWho(
    (db().prepare("select user_id from forum_subs where thread_id = ?").all(threadId) as { user_id: number }[]).map((r) => r.user_id).filter((x) => !mentioned.includes(x)),
    (x) => canSeeThread(x, t),
  );
  notify(subs, { kind: "forum", actorId: u.id, title: `${u.name} replied to “${t.title}”`, body: b.text.slice(0, 160), url });
  broadcast("thread", { id: threadId, reply: id, by: u.id });
  return id;
}

export function editThread(u: User, id: number, o: { title: string; html: string }) {
  const t = threadRow(id);
  if (!t) throw new ForumError("That thread is gone.");
  if (t.author_id !== u.id && !u.isMod) throw new ForumError("You can only edit your own posts.");
  const title = cleanLine(o.title, 160) || t.title;
  const b = cleanHtml(o.html);
  if (b.empty) throw new ForumError("Write something first.");
  db().prepare("update forum_threads set title = ?, body_html = ?, body_text = ?, edited_at = ? where id = ?").run(title, b.html, b.text, now(), id);
  indexItem("thread", id, threadScope(categoryRow(t.category_id)!), t.author_id, t.created_at, title, b.text);
}

export function editReply(u: User, id: number, html: string) {
  const r = db().prepare("select * from forum_posts where id = ?").get(id) as ReplyRow | undefined;
  if (!r) throw new ForumError("That reply is gone.");
  if (r.author_id !== u.id && !u.isMod) throw new ForumError("You can only edit your own posts.");
  const b = cleanHtml(html);
  if (b.empty) throw new ForumError("Write something first.");
  db().prepare("update forum_posts set body_html = ?, body_text = ?, edited_at = ? where id = ?").run(b.html, b.text, now(), id);
  const t = threadRow(r.thread_id)!;
  indexItem("reply", id, threadScope(categoryRow(t.category_id)!), r.author_id, r.created_at, t.title, b.text);
}

export function deleteReply(u: User, id: number) {
  const r = db().prepare("select * from forum_posts where id = ?").get(id) as ReplyRow | undefined;
  if (!r) return;
  if (r.author_id !== u.id && !u.isMod) throw new ForumError("You can only delete your own posts.");
  tx(() => {
    db().prepare("delete from forum_posts where id = ?").run(id);
    const last = db().prepare("select created_at, author_id from forum_posts where thread_id = ? order by created_at desc limit 1").get(r.thread_id) as { created_at: number; author_id: number } | undefined;
    const t = threadRow(r.thread_id)!;
    db().prepare("update forum_threads set reply_count = max(0, reply_count - 1), last_post_at = ?, last_post_by = ? where id = ?").run(last?.created_at ?? t.created_at, last?.author_id ?? t.author_id, r.thread_id);
  });
  clearReactions("reply", id);
  unindex("reply", id);
}

export function deleteThread(u: User, id: number) {
  const t = threadRow(id);
  if (!t) return;
  if (!u.isMod && !(t.author_id === u.id && t.reply_count === 0)) throw new ForumError("Only moderators can delete a thread with replies.");
  const replies = (db().prepare("select id from forum_posts where thread_id = ?").all(id) as { id: number }[]).map((r) => r.id);
  tx(() => {
    for (const r of replies) {
      unindex("reply", r);
      clearReactions("reply", r);
    }
    clearReactions("thread", id);
    unindex("thread", id);
    db().prepare("delete from bookmarks where target_type = 'thread' and target_id = ?").run(id);
    db().prepare("delete from forum_threads where id = ?").run(id);
  });
}

export function moderateThread(u: User, id: number, o: { pinned?: boolean; locked?: boolean; categoryId?: number }) {
  if (!u.isMod) throw new ForumError("Only moderators can do that.");
  const t = threadRow(id);
  if (!t) return;
  if (o.pinned !== undefined) db().prepare("update forum_threads set pinned = ? where id = ?").run(o.pinned ? 1 : 0, id);
  if (o.locked !== undefined) db().prepare("update forum_threads set locked = ? where id = ?").run(o.locked ? 1 : 0, id);
  if (o.categoryId && categoryRow(o.categoryId)) {
    db().prepare("update forum_threads set category_id = ? where id = ?").run(o.categoryId, id);
    const c = categoryRow(o.categoryId)!;
    db().prepare("update search_index set scope = ? where (kind = 'thread' and ref = ?) or (kind = 'reply' and ref in (select id from forum_posts where thread_id = ?))").run(threadScope(c), id, id);
  }
}

export function follow(u: User, id: number, on: boolean) {
  const t = threadRow(id);
  if (on && (!t || !canSeeThread(u, t))) throw new ForumError("That thread is gone.");
  if (on) db().prepare("insert or ignore into forum_subs (thread_id, user_id) values (?, ?)").run(id, u.id);
  else db().prepare("delete from forum_subs where thread_id = ? and user_id = ?").run(id, u.id);
}

export function quoteFor(u: User, threadId: number, replyId: number): string | null {
  const t = threadRow(threadId);
  if (!t || !canSeeThread(u, t)) return null;
  if (replyId === 0) return `<blockquote><p><strong>${esc(summaries([t.author_id]).get(t.author_id)?.name ?? "Someone")} wrote:</strong></p>${t.body_html}</blockquote><p></p>`;
  const r = db().prepare("select * from forum_posts where id = ? and thread_id = ?").get(replyId, threadId) as ReplyRow | undefined;
  if (!r) return null;
  return `<blockquote><p><strong>${esc(summaries([r.author_id]).get(r.author_id)?.name ?? "Someone")} wrote:</strong></p>${r.body_html}</blockquote><p></p>`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ── categories (Admin, and group admins for their group's) ──

export function saveCategory(u: User, o: { id?: number; name: string; description?: string; color?: string; icon?: string; locked?: boolean; groupId?: number | null }) {
  if (!u.isMod) throw new ForumError("Only moderators can change the categories.");
  const name = cleanLine(o.name, 60);
  if (!name) throw new ForumError("Give the category a name.");
  const color = o.color && /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : null;
  const icon = [...(o.icon || "")].slice(0, 2).join("");
  if (o.id) {
    db().prepare("update forum_categories set name = ?, description = ?, color = ?, icon = ?, locked = ?, group_id = ? where id = ?").run(name, cleanLine(o.description, 300), color, icon, o.locked ? 1 : 0, o.groupId ?? null, o.id);
    return o.id;
  }
  const pos = (db().prepare("select coalesce(max(position), -1) + 1 p from forum_categories").get() as { p: number }).p;
  return Number(
    db()
      .prepare("insert into forum_categories (slug, name, description, color, icon, position, locked, group_id, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(slugify(name), name, cleanLine(o.description, 300), color, icon, pos, o.locked ? 1 : 0, o.groupId ?? null, now()).lastInsertRowid,
  );
}

export function moveCategory(u: User, id: number, dir: -1 | 1) {
  if (!u.isMod) throw new ForumError("Only moderators can change the categories.");
  const list = db().prepare("select id from forum_categories order by position, name").all() as { id: number }[];
  const i = list.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  tx(() => list.forEach((c, k) => db().prepare("update forum_categories set position = ? where id = ?").run(k, c.id)));
}

export function deleteCategory(u: User, id: number, moveTo?: number) {
  if (!u.isAdmin) throw new ForumError("Only admins can delete categories.");
  tx(() => {
    if (moveTo && moveTo !== id && categoryRow(moveTo)) db().prepare("update forum_threads set category_id = ? where category_id = ?").run(moveTo, id);
    else {
      const ts = (db().prepare("select id from forum_threads where category_id = ?").all(id) as { id: number }[]).map((r) => r.id);
      for (const t of ts) deleteThread({ ...u, isMod: true } as User, t);
    }
    db().prepare("delete from forum_categories where id = ?").run(id);
  });
}

export function latestThreads(u: User, limit = 5): ThreadCard[] {
  return threads(u, { sort: "active", limit }).list;
}
