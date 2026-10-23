import "server-only";
import { db } from "./db";
import { summaries } from "./users";
import type { UserSummary } from "./types";

/**
 * Site-wide search: one full-text index (SQLite FTS5) over posts, news, comments, forum threads and
 * replies, polls, events, chat messages, groups and members. Each entry has a scope that decides
 * who may find it:
 *   members  everyone signed in
 *   g:<id>   a group's members (anyone, for an open group)
 *   r:<id>   a chat room's members (anyone, for an open room)
 *   u:<id>   only that member
 */

export type SearchKind = "post" | "news" | "comment" | "thread" | "reply" | "poll" | "event" | "message" | "group" | "user" | "room";

export const KIND_LABEL: Record<SearchKind, string> = {
  post: "Post",
  news: "News",
  comment: "Comment",
  thread: "Forum thread",
  reply: "Forum reply",
  poll: "Poll",
  event: "Event",
  message: "Chat",
  group: "Group",
  user: "Member",
  room: "Chat room",
};

const URL_FOR: Record<SearchKind, (ref: number) => string> = {
  post: (r) => `/posts/${r}`,
  news: (r) => `/posts/${r}`,
  comment: (r) => `/go/comment/${r}`,
  thread: (r) => `/forum/t/${r}`,
  reply: (r) => `/go/reply/${r}`,
  poll: (r) => `/polls/${r}`,
  event: (r) => `/events/${r}`,
  message: (r) => `/go/message/${r}`,
  group: (r) => `/go/group/${r}`,
  user: (r) => `/go/user/${r}`,
  room: (r) => `/chat/${r}`,
};

export function indexItem(kind: SearchKind, ref: number, scope: string, authorId: number | null, createdAt: number, title: string, body: string, url?: string) {
  const d = db();
  d.prepare("delete from search_index where kind = ? and ref = ?").run(kind, ref);
  d.prepare("insert into search_index (kind, ref, scope, author_id, created_at, url, title, body) values (?, ?, ?, ?, ?, ?, ?, ?)").run(
    kind,
    ref,
    scope,
    authorId,
    createdAt,
    url ?? URL_FOR[kind](ref),
    title.slice(0, 300),
    body.slice(0, 20000),
  );
}

export function unindex(kind: SearchKind, ref: number) {
  db().prepare("delete from search_index where kind = ? and ref = ?").run(kind, ref);
}

/** Change the scope of everything in a place (a room or group changed its privacy). */
export function rescope(from: string, to: string) {
  db().prepare("update search_index set scope = ? where scope = ?").run(to, from);
}

/** The scopes someone may read. */
export function scopesFor(userId: number): string[] {
  const groups = db()
    .prepare("select id from groups where privacy = 'open' or id in (select group_id from group_members where user_id = ?)")
    .all(userId) as { id: number }[];
  const rooms = db()
    .prepare("select id from rooms where (visibility = 'open' and kind = 'room') or id in (select room_id from room_members where user_id = ?)")
    .all(userId) as { id: number }[];
  return ["members", `u:${userId}`, ...groups.map((g) => `g:${g.id}`), ...rooms.map((r) => `r:${r.id}`)];
}

/** Turn what someone typed into an FTS5 query: every word must match, the last one as a prefix. */
export function ftsQuery(q: string): string | null {
  const words = q
    .toLowerCase()
    .replace(/["*^():{}[\]]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[-+]+/, ""))
    .filter((w) => w.length > 0)
    .slice(0, 8);
  if (!words.length) return null;
  return words.map((w, i) => `"${w}"${i === words.length - 1 ? "*" : ""}`).join(" ");
}

export interface SearchHit {
  kind: SearchKind;
  ref: number;
  url: string;
  title: string;
  snippet: string;
  createdAt: number;
  author: UserSummary | null;
}

export function search(userId: number, q: string, opts: { kinds?: SearchKind[]; limit?: number; offset?: number; author?: number } = {}): { hits: SearchHit[]; counts: Partial<Record<SearchKind, number>> } {
  const match = ftsQuery(q);
  if (!match) return { hits: [], counts: {} };
  const scopes = scopesFor(userId);
  const scopeSql = `scope in (${scopes.map(() => "?").join(",")})`;
  const where = `search_index match ? and ${scopeSql}`;
  const params: unknown[] = [match, ...scopes];
  let filter = "";
  const fparams: unknown[] = [];
  if (opts.kinds?.length) {
    filter += ` and kind in (${opts.kinds.map(() => "?").join(",")})`;
    fparams.push(...opts.kinds);
  }
  if (opts.author) {
    filter += " and author_id = ?";
    fparams.push(opts.author);
  }
  try {
    const rows = db()
      .prepare(
        `select kind, ref, url, author_id, created_at,
           highlight(search_index, 6, '\u0001', '\u0002') title,
           snippet(search_index, 7, '\u0001', '\u0002', '…', 18) snip
         from search_index where ${where}${filter}
         order by bm25(search_index, 0, 0, 0, 0, 0, 0, 4.0, 1.0) +(case when kind in ('user','group','room') then -2 else 0 end), created_at desc
         limit ? offset ?`,
      )
      .all(...params, ...fparams, opts.limit ?? 30, opts.offset ?? 0) as { kind: SearchKind; ref: number; url: string; author_id: number | null; created_at: number; title: string; snip: string }[];
    const countRows = db()
      .prepare(`select kind, count(*) n from search_index where ${where} group by kind`)
      .all(...params) as { kind: SearchKind; n: number }[];
    const authors = summaries(rows.map((r) => r.author_id!).filter(Boolean));
    return {
      hits: rows.map((r) => ({
        kind: r.kind,
        ref: r.ref,
        url: r.url,
        title: r.title,
        snippet: r.snip,
        createdAt: r.created_at,
        author: r.author_id ? authors.get(r.author_id) ?? null : null,
      })),
      counts: Object.fromEntries(countRows.map((c) => [c.kind, c.n])),
    };
  } catch {
    return { hits: [], counts: {} };
  }
}

export function plain(html: string): string {
  return html
    .replace(/<(br|\/p|\/h\d|\/li|\/blockquote|\/tr|\/td|\/th|\/pre|hr)[^>]*>/gi, "\n")
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, " $1 ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}
