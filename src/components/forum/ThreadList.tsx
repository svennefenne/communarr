"use client";

import Link from "next/link";
import { Eye, Lock, MessagesSquare, Pin } from "lucide-react";
import type { ThreadCard } from "@/lib/contentTypes";
import { Avatar } from "@/components/ui/Avatar";
import { Time } from "@/components/ui/Time";
import { CategoryChip } from "@/components/feed/ThreadCard";
import { useT } from "@/components/app/AppProvider";

/** Threads as rows: title and who started it, replies and views, the last post. */
export function ThreadList({ threads, showCategory = false }: { threads: ThreadCard[]; showCategory?: boolean }) {
  const tr = useT();
  return (
    <div className="panel thread-list">
      {threads.map((t) => (
        <Link key={t.id} href={`/forum/t/${t.id}`} className={`thread-row ${t.unread ? "unread" : ""}`}>
          <Avatar user={t.author} size={38} />
          <span className="thread-main">
            <span className="thread-title">
              {t.pinned ? <Pin size={14} className="thread-flag" /> : null}
              {t.locked ? <Lock size={14} className="thread-flag" /> : null}
              {t.unread ? <span className="dot" title={tr("New")} /> : null}
              <span>{t.title}</span>
            </span>
            <span className="tiny muted row wrap" style={{ gap: "2px 8px" }}>
              {showCategory ? <CategoryChip c={t.category} link={false} /> : null}
              <span>
                {t.author.name} · <Time t={t.createdAt} />
              </span>
            </span>
          </span>
          <span className="thread-stats">
            <span title={tr("Replies")}>
              <MessagesSquare size={14} /> {t.replies}
            </span>
            <span title={tr("Views")}>
              <Eye size={14} /> {t.views}
            </span>
          </span>
          <span className="thread-last">
            {t.lastBy ? <Avatar user={t.lastBy} size={22} /> : null}
            <span className="tiny muted">
              <Time t={t.lastPostAt} />
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
