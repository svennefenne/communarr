import "server-only";
import { db } from "./db";
import { groupFilter } from "./groups";
import { toPostViews, type PostRow } from "./posts";
import { toThreadCards, type ThreadRow } from "./forum";
import { closeDuePolls, toPollViews, type PollRow } from "./polls";
import { toEventViews, type EventRow } from "./events";
import { readableGroupIds } from "./groups";
import { getSettings } from "./settings";
import type { User } from "./users";
import type { FeedFilter, FeedItem } from "./contentTypes";

/**
 * The front page's feed: posts, news, new forum threads, polls and events, newest first, in pages
 * (`before` is the time of the last item shown).
 */
export function feed(u: User, o: { filter?: FeedFilter; before?: number; limit?: number; groupId?: number; authorId?: number } = {}): { items: FeedItem[]; next: number | null } {
  const f = o.filter ?? "all";
  const limit = o.limit ?? 15;
  const feats = getSettings().features;
  const before = o.before ?? Number.MAX_SAFE_INTEGER;
  const gf = groupFilter(u, o.groupId ? "group_id" : "group_id");
  const scope = (col = "group_id") => {
    const parts = [gf.sql.replaceAll("group_id", col)];
    const params: unknown[] = [...gf.params];
    if (o.groupId) {
      parts.push(`${col} = ?`);
      params.push(o.groupId);
    }
    return { sql: parts.join(" and "), params };
  };
  const by = (col: string) => (o.authorId ? { sql: ` and ${col} = ?`, params: [o.authorId] } : { sql: "", params: [] as unknown[] });
  const items: FeedItem[] = [];

  if (f === "all" || f === "posts" || f === "news") {
    const s = scope();
    const a = by("author_id");
    const kinds = f === "posts" ? ["post"] : f === "news" ? (feats.news ? ["news"] : []) : feats.news ? ["post", "news"] : ["post"];
    if (kinds.length) {
      const rows = db()
        .prepare(`select * from posts where ${s.sql}${a.sql} and visibility = 'members' and kind in (${kinds.map(() => "?").join(",")}) and created_at < ? order by created_at desc limit ?`)
        .all(...s.params, ...a.params, ...kinds, before, limit + 1) as PostRow[];
      for (const p of toPostViews(u, rows)) items.push({ type: "post", at: p.createdAt, post: p });
    }
  }
  if ((f === "all" || f === "forum") && feats.forum) {
    const groups = readableGroupIds(u);
    const cats = (db().prepare("select id, group_id from forum_categories").all() as { id: number; group_id: number | null }[])
      .filter((c) => (!c.group_id || groups.includes(c.group_id)) && (!o.groupId || c.group_id === o.groupId))
      .map((c) => c.id);
    if (cats.length) {
      const a = by("author_id");
      const rows = db()
        .prepare(`select * from forum_threads where category_id in (${cats.map(() => "?").join(",")})${a.sql} and created_at < ? order by created_at desc limit ?`)
        .all(...cats, ...a.params, before, limit + 1) as ThreadRow[];
      for (const t of toThreadCards(u, rows)) items.push({ type: "thread", at: t.createdAt, thread: t });
    }
  }
  if ((f === "all" || f === "polls") && feats.polls) {
    closeDuePolls();
    const s = scope();
    const a = by("author_id");
    const rows = db().prepare(`select * from polls where ${s.sql}${a.sql} and created_at < ? order by created_at desc limit ?`).all(...s.params, ...a.params, before, limit + 1) as PollRow[];
    for (const p of toPollViews(u, rows)) items.push({ type: "poll", at: p.createdAt, poll: p });
  }
  if ((f === "all" || f === "events") && feats.calendar) {
    const s = scope();
    const a = by("author_id");
    const rows = db().prepare(`select * from events where ${s.sql}${a.sql} and created_at < ? order by created_at desc limit ?`).all(...s.params, ...a.params, before, limit + 1) as EventRow[];
    for (const e of toEventViews(u, rows)) items.push({ type: "event", at: e.createdAt, event: e });
  }
  items.sort((a, b) => b.at - a.at);
  const page = items.slice(0, limit);
  return { items: page, next: items.length > limit ? page[page.length - 1].at : null };
}
