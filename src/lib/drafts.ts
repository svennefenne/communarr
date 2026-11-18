import "server-only";
import { db, now } from "./db";
import { UserError } from "./errors";
import { cleanHtml } from "./sanitize";
import type { User } from "./users";
import type { DraftKind, DraftSummary, PostDraft } from "./types";

/**
 * A post or a forum thread saved as a draft ("Save draft" in the composer, or in a new thread's form):
 * only its writer sees it, on any of their devices, until they open it again and post it, or delete it.
 * Where it was going is kept as the form had it: a post's "all", "me" or "g:<group>" (a group they've
 * left since falls back to everyone when it's opened), a thread's "c:<category>". The editor also keeps
 * what's being written on the device (Editor's draftKey); that's the unsaved text, this is a saved one.
 */

/** drafts a member can keep at once */
const MAX = 50;

export interface DraftInput {
  /** a post (the default) or a forum thread */
  kind?: DraftKind;
  title?: string;
  html: string;
  /** a post's "all", "me" or "g:<group id>"; a thread's "c:<category id>" */
  target: string;
  news?: boolean;
  cover?: string | null;
  notifyAll?: boolean;
}

interface Row {
  id: number;
  user_id: number;
  kind: DraftKind;
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

const cleanTarget = (kind: DraftKind, t: string) => (kind === "thread" ? (/^c:\d{1,9}$/.test(t) ? t : "") : t === "me" || /^g:\d{1,9}$/.test(t) ? t : "all");
const safeMedia = (s?: string | null) => (s && /^\/media\/[\w./-]+$/.test(s) ? s : null);
const toSummary = (r: Pick<Row, "id" | "kind" | "target" | "news" | "preview" | "updated_at">): DraftSummary => ({ id: r.id, kind: r.kind, target: r.target, news: !!r.news, preview: r.preview, updatedAt: r.updated_at });

/** Save a draft: a new one, or (`id`, theirs) the one they opened. Its id. */
export function saveDraft(u: User, id: number | null, o: DraftInput): number {
  const kind: DraftKind = o.kind === "thread" ? "thread" : "post";
  const c = cleanHtml(o.html);
  const title = String(o.title ?? "").replace(/\s+/g, " ").trim().slice(0, kind === "thread" ? 160 : 140);
  if (c.empty && !title) throw new UserError("Write something first.");
  const news = kind === "post" && o.news && u.isMod ? 1 : 0;
  // (what the list shows: its title, or the start of its text)
  const preview = (title || c.text).replace(/\s+/g, " ").trim().slice(0, 160);
  const fields = [news ? "all" : cleanTarget(kind, String(o.target)), news, title, c.html, preview, news ? safeMedia(o.cover) : null, o.notifyAll === false ? 0 : 1, now()] as const;
  if (id) {
    const r = db().prepare("update post_drafts set target = ?, news = ?, title = ?, body_html = ?, preview = ?, cover = ?, notify_all = ?, updated_at = ? where id = ? and user_id = ? and kind = ?").run(...fields, id, u.id, kind);
    if (r.changes) return id;
  }
  const n = (db().prepare("select count(*) n from post_drafts where user_id = ?").get(u.id) as { n: number }).n;
  if (n >= MAX) throw new UserError("You have {n} drafts already: post or delete some first.", { n: MAX });
  return Number(
    db()
      .prepare("insert into post_drafts (target, news, title, body_html, preview, cover, notify_all, updated_at, user_id, created_at, kind) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(...fields, u.id, now(), kind).lastInsertRowid,
  );
}

/** Their drafts of a kind, the latest first. */
export function listDrafts(userId: number, kind: DraftKind = "post"): DraftSummary[] {
  return (db().prepare("select id, kind, target, news, preview, updated_at from post_drafts where user_id = ? and kind = ? order by updated_at desc").all(userId, kind === "thread" ? "thread" : "post") as Row[]).map(toSummary);
}

/** One of their drafts, whole (to open in the composer). */
export function getDraft(u: User, id: number): PostDraft | null {
  const r = db().prepare("select * from post_drafts where id = ? and user_id = ?").get(id, u.id) as Row | undefined;
  return r ? { ...toSummary(r), title: r.title, html: r.body_html, cover: r.cover, notifyAll: !!r.notify_all } : null;
}

export function deleteDraft(u: User, id: number) {
  db().prepare("delete from post_drafts where id = ? and user_id = ?").run(id, u.id);
}
