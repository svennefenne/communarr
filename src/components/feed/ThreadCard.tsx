"use client";

import Link from "next/link";
import { Eye, Lock, MessagesSquare, Pin } from "lucide-react";
import type { ThreadCard as Thread } from "@/lib/contentTypes";
import { Avatar, UserLink } from "@/components/ui/Avatar";
import { Time } from "@/components/ui/Time";
import { GroupChip } from "./PostCard";

export function CategoryChip({ c, link = true }: { c: Thread["category"]; link?: boolean }) {
  const inner = (
    <>
      {c.icon ? <span>{c.icon}</span> : null}
      {c.name}
    </>
  );
  // inside another link (a thread row) it's just a label
  if (!link)
    return (
      <span className="cat-chip" style={{ ["--cc" as string]: c.color }}>
        {inner}
      </span>
    );
  return (
    <Link href={`/forum/${c.slug}`} className="cat-chip" style={{ ["--cc" as string]: c.color }}>
      {inner}
    </Link>
  );
}

/** A new forum thread, in the feed. */
export function ThreadFeedCard({ thread: t }: { thread: Thread }) {
  return (
    <article className="panel thread-feed-card">
      <header className="post-head">
        <span className="kind-icon forum">
          <MessagesSquare size={20} />
        </span>
        <div className="grow small" style={{ minWidth: 0 }}>
          <UserLink user={t.author} /> <span className="muted">started a thread in</span> <CategoryChip c={t.category} />
          {t.group ? <GroupChip g={t.group} /> : null}
          <div className="tiny muted">
            <Time t={t.createdAt} />
          </div>
        </div>
      </header>
      <Link href={`/forum/t/${t.id}`} className="thread-feed-body">
        <span className="h3">
          {t.pinned ? <Pin size={14} style={{ marginRight: 6, verticalAlign: -1 }} /> : null}
          {t.locked ? <Lock size={14} style={{ marginRight: 6, verticalAlign: -1 }} /> : null}
          {t.title}
        </span>
        <span className="small dim clamp-3">{t.excerpt}</span>
      </Link>
      <footer className="post-foot small muted">
        <span className="row" style={{ gap: 5 }}>
          <MessagesSquare size={14} /> {t.replies} {t.replies === 1 ? "reply" : "replies"}
        </span>
        <span className="row" style={{ gap: 5 }}>
          <Eye size={14} /> {t.views}
        </span>
        {t.lastBy && t.replies ? (
          <span className="row" style={{ gap: 6 }}>
            <Avatar user={t.lastBy} size={18} /> last <Time t={t.lastPostAt} />
          </span>
        ) : null}
        <span className="spacer" />
        <Link href={`/forum/t/${t.id}`} className="btn btn-sm">
          Join in
        </Link>
      </footer>
    </article>
  );
}
