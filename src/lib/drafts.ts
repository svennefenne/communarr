import "server-only";
import { db, now } from "./db";
import { UserError } from "./errors";
import { cleanHtml } from "./sanitize";
import type { User } from "./users";
import type { DraftSummary, PostDraft } from "./types";

/**
 * A post saved as a draft (the composer's "Save as draft"): only its writer sees it, on any of their
 * devices, until they open it again and post it, or delete it. Where it was going ("all", "me" or
 * "g:<group>") is kept as the composer had it; a group they've left since falls back to everyone when
 * it's opened. The editor also keeps what's being written on the device (Editor's draftKey); that's
 * the unsaved text, this is a saved one.
 */

/** drafts a member can keep at once */
const MAX = 50;

export interface DraftInput {
  title?: string;
  html: string;
  /** "all", "me" or "g:<group id>" */
  target: string;
  news?: boolean;
  cover?: string | null;
  notifyAll?: boolean;
}

interface Row {
  id: number;
  user_id: number;
  target: string;
  news: number;
  title: string;
  body_html: string;
  preview: string;
  cover: string | null;
  notify_all: number;
  created_at: number;
  updated_at: number;
}

const cleanTarget = (t: string) => (t === "me" || /^g:\d{1,9}$/.test(t) ? t : "all");
const safeMedia = (s?: string | null) => (s && /^\/media\/[\w./-]+$/.test(s) ? s : null);
const toSummary = (r: Pick<Row, "id" | "target" | "news" | "preview" | "updated_at">): DraftSummary => ({ id: r.id, target: r.target, news: !!r.news, preview: r.preview, updatedAt: r.updated_at });

/** Save a draft: a new one, or (`id`, theirs) the one they opened. Its id. */
export function saveDraft(u: User, id: number | null, o: DraftInput): number {
  const c = cleanHtml(o.html);
  const title = String(o.title ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
  if (c.empty && !title) throw new UserError("Write something first.");
  const news = o.news && u.isMod ? 1 : 0;
  // (what the list shows: its title, or the start of its text)
  const preview = (title || c.text).replace(/\s+/g, " ").trim().slice(0, 160);
  const fields = [news ? "all" : cleanTarget(String(o.target)), news, title, c.html, preview, news ? safeMedia(o.cover) : null, o.notifyAll === false ? 0 : 1, now()] as const;
  if (id) {
    const r = db().prepare("update post_drafts set target = ?, news = ?, title = ?, body_html = ?, preview = ?, cover = ?, notify_all = ?, updated_at = ? where id = ? and user_id = ?").run(...fields, id, u.id);
    if (r.changes) return id;
  }
  const n = (db().prepare("select count(*) n from post_drafts where user_id = ?").get(u.id) as { n: number }).n;
  if (n >= MAX) throw new UserError("You have {n} drafts already: post or delete some first.", { n: MAX });
  return Number(
    db()
      .prepare("insert into post_drafts (target, news, title, body_html, preview, cover, notify_all, updated_at, user_id, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(...fields, u.id, now()).lastInsertRowid,
  );
}

/** Their drafts, the latest first. */
export function listDrafts(userId: number): DraftSummary[] {
  return (db().prepare("select id, target, news, preview, updated_at from post_drafts where user_id = ? order by updated_at desc").all(userId) as Row[]).map(toSummary);
}

/** One of their drafts, whole (to open in the composer). */
export function getDraft(u: User, id: number): PostDraft | null {
  const r = db().prepare("select * from post_drafts where id = ? and user_id = ?").get(id, u.id) as Row | undefined;
  return r ? { ...toSummary(r), title: r.title, html: r.body_html, cover: r.cover, notifyAll: !!r.notify_all } : null;
}

export function deleteDraft(u: User, id: number) {
  db().prepare("delete from post_drafts where id = ? and user_id = ?").run(id, u.id);
}
