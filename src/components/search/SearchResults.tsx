"use client";

import Link from "next/link";
import { CalendarDays, FileText, Hash, MessageCircle, MessagesSquare, Newspaper, UserRound, UsersRound, Vote, MessageSquareText } from "lucide-react";
import type { SearchHit, SearchKind } from "@/lib/search";
import { Time } from "@/components/ui/Time";
import { useT } from "@/components/app/AppProvider";

export const KIND_ICON: Record<SearchKind, React.ComponentType<{ size?: number }>> = {
  post: FileText,
  news: Newspaper,
  comment: MessageSquareText,
  thread: MessagesSquare,
  reply: MessagesSquare,
  poll: Vote,
  event: CalendarDays,
  message: MessageCircle,
  group: UsersRound,
  user: UserRound,
  room: Hash,
};

export const KIND_NAMES: Record<SearchKind, string> = {
  post: "Posts",
  news: "News",
  comment: "Comments",
  thread: "Forum threads",
  reply: "Forum replies",
  poll: "Polls",
  event: "Events",
  message: "Chat",
  group: "Groups",
  user: "Members",
  room: "Chat rooms",
};

/** One of a kind, for a hit's line ("News" alone would read as the whole section). */
const KIND_ONE: Record<SearchKind, string> = {
  post: "Post",
  news: "News post",
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

/** Text with the search words marked (\u0001…\u0002 from the server). */
export function Marked({ text }: { text: string }) {
  const parts = text.split(/(\u0001[^\u0002]*\u0002)/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith("\u0001") ? <mark key={i} className="hit">{p.slice(1, -1)}</mark> : <span key={i}>{p}</span>))}
    </>
  );
}

export function HitRow({ h, onPick }: { h: SearchHit; onPick?: () => void }) {
  const t = useT();
  const Icon = KIND_ICON[h.kind] || FileText;
  return (
    <Link href={h.url} className="list-row search-hit" onClick={onPick}>
      <span className="hit-icon">
        <Icon size={16} />
      </span>
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="hit-title ellipsis">
          <Marked text={h.title} />
        </span>
        {h.snippet ? (
          <span className="hit-snip clamp-2">
            <Marked text={h.snippet} />
          </span>
        ) : null}
        <span className="tiny faint">
          {t(KIND_ONE[h.kind])}
          {h.author && h.kind !== "user" ? ` · ${h.author.name}` : ""} · <Time t={h.createdAt} />
        </span>
      </span>
    </Link>
  );
}
