import "server-only";
import { UserError } from "./errors";
import { db, now } from "./db";
import { notify } from "./notify";
import { reactionsFor, clearReactions } from "./reactions";
import { cleanHtml } from "./sanitize";
import { indexItem, unindex } from "./search";
import { canSeePost, postRow } from "./posts";
import { canSeePoll, pollRow } from "./polls";
import { canSeeEvent, eventRow } from "./events";
import { groupScope } from "./groups";
import { GHOST, summaries, userByName, type User } from "./users";
import { broadcast } from "./hub";
import type { CommentView } from "./contentTypes";

export type CommentTarget = "post" | "poll" | "event";

interface CommentRow {
  id: number;
  target_type: CommentTarget;
  target_id: number;
  author_id: number;
  parent_id: number | null;
  body_html: string;
  body_text: string;
  created_at: number;
  edited_at: number | null;
}

export class CommentError extends UserError {}

/** Who may see and comment on a thing, and what to call it in notifications. */
function target(u: User, type: CommentTarget, id: number): { authorId: number; title: string; url: string; locked: boolean; scope: string } | null {
  if (type === "post") {
    const p = postRow(id);
    if (!p || !canSeePost(u, p)) return null;
    return { authorId: p.author_id, title: p.title || p.body_text.slice(0, 60), url: `/posts/${id}`, locked: !!p.comments_locked, scope: p.visibility === "private" ? `u:${p.author_id}` : groupScope(p.group_id) };
  }
  if (type === "poll") {
    const p = pollRow(id);
    if (!p || !canSeePoll(u, p)) return null;
    return { authorId: p.author_id, title: p.question, url: `/polls/${id}`, locked: false, scope: groupScope(p.group_id) };
  }
  const e = eventRow(id);
  if (!e || !canSeeEvent(u, e)) return null;
  return { authorId: e.author_id, title: e.title, url: `/events/${id}`, locked: false, scope: groupScope(e.group_id) };
}

export function listComments(u: User, type: CommentTarget, id: number): CommentView[] {
  if (!target(u, type, id)) return [];
  const rows = db().prepare("select * from comments where target_type = ? and target_id = ? order by created_at, id").all(type, id) as CommentRow[];
  const people = summaries(rows.map((r) => r.author_id));
  const reacts = reactionsFor("comment", rows.map((r) => r.id), u.id);
  const views = new Map<number, CommentView>();
  const top: CommentView[] = [];
  for (const r of rows) {
    const v: CommentView = {
      id: r.id,
      parentId: r.parent_id,
      author: people.get(r.author_id) ?? GHOST,
      html: r.body_html,
      createdAt: r.created_at,
      editedAt: r.edited_at,
      reactions: reacts.get(r.id) ?? [],
      canEdit: r.author_id === u.id,
      canDelete: r.author_id === u.id || u.isMod,
      replies: [],
    };
    views.set(r.id, v);
    const parent = r.parent_id ? views.get(r.parent_id) : null;
    if (parent) parent.replies.push(v);
    else top.push(v);
  }
  return top;
}

export function addComment(u: User, type: CommentTarget, id: number, html: string, parentId?: number | null): CommentView {
  const t = target(u, type, id);
  if (!t) throw new CommentError("That's gone.");
  if (t.locked && !u.isMod) throw new CommentError("Comments are closed here.");
  const c = cleanHtml(html, { maxLength: 100_000 });
  if (c.empty) throw new CommentError("Write something first.");
  // replies hang off a top-level comment (one level deep keeps it readable on a phone)
  let parent: CommentRow | undefined;
  if (parentId) {
    parent = db().prepare("select * from comments where id = ? and target_type = ? and target_id = ?").get(parentId, type, id) as CommentRow | undefined;
    if (parent?.parent_id) parent = db().prepare("select * from comments where id = ?").get(parent.parent_id) as CommentRow | undefined;
  }
  const ts = now();
  const cid = Number(
    db()
      .prepare("insert into comments (target_type, target_id, author_id, parent_id, body_html, body_text, created_at) values (?, ?, ?, ?, ?, ?, ?)")
      .run(type, id, u.id, parent?.id ?? null, c.html, c.text, ts).lastInsertRowid,
  );
  indexItem("comment", cid, t.scope, u.id, ts, `Comment on ${t.title}`, c.text);
  const url = `${t.url}#c-${cid}`;
  const body = c.text.slice(0, 160);
  const mentioned = c.mentions.map((n) => userByName(n)?.id).filter((x): x is number => !!x);
  if (mentioned.length) notify(mentioned, { kind: "mention", actorId: u.id, title: `${u.name} mentioned you in a comment`, body, url });
  const told = new Set([u.id, ...mentioned]);
  if (parent && !told.has(parent.author_id)) {
    notify([parent.author_id], { kind: "reply", actorId: u.id, title: `${u.name} answered your comment on “${t.title}”`, body, url });
    told.add(parent.author_id);
  }
  if (!told.has(t.authorId)) notify([t.authorId], { kind: "reply", actorId: u.id, title: `${u.name} commented on “${t.title}”`, body, url });
  // others who commented hear about new comments too (not the ones told already)
  const others = (db().prepare("select distinct author_id from comments where target_type = ? and target_id = ?").all(type, id) as { author_id: number }[]).map((r) => r.author_id).filter((x) => !told.has(x) && x !== t.authorId);
  if (others.length) notify(others, { kind: "reply", actorId: u.id, title: `${u.name} also commented on “${t.title}”`, body, url });
  broadcast("comment", { type, id, comment: cid, by: u.id });
  return listComments(u, type, id).flatMap((x) => [x, ...x.replies]).find((x) => x.id === cid)!;
}

export function editComment(u: User, cid: number, html: string) {
  const r = db().prepare("select * from comments where id = ?").get(cid) as CommentRow | undefined;
  if (!r) throw new CommentError("That comment is gone.");
  if (r.author_id !== u.id) throw new CommentError("You can only edit your own comments.");
  const c = cleanHtml(html, { maxLength: 100_000 });
  if (c.empty) throw new CommentError("Write something first.");
  db().prepare("update comments set body_html = ?, body_text = ?, edited_at = ? where id = ?").run(c.html, c.text, now(), cid);
  const t = target(u, r.target_type, r.target_id);
  if (t) indexItem("comment", cid, t.scope, u.id, r.created_at, `Comment on ${t.title}`, c.text);
}

export function deleteComment(u: User, cid: number) {
  const r = db().prepare("select * from comments where id = ?").get(cid) as CommentRow | undefined;
  if (!r) return;
  if (r.author_id !== u.id && !u.isMod) throw new CommentError("You can only delete your own comments.");
  const ids = [cid, ...(db().prepare("select id from comments where parent_id = ?").all(cid) as { id: number }[]).map((x) => x.id)];
  for (const id of ids) {
    clearReactions("comment", id);
    unindex("comment", id);
  }
  db().prepare("delete from comments where id = ?").run(cid);
}
