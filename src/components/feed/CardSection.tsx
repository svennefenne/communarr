"use client";

import { CalendarDays, FileText, MessagesSquare, Newspaper, Vote } from "lucide-react";
import { useT } from "@/components/app/AppProvider";

export type SectionKind = "post" | "news" | "event" | "poll" | "thread";

/** each kind of card and the part of the site it belongs to (the names in the menus) */
const SECTIONS: Record<SectionKind, { label: string; icon: React.ComponentType<{ size?: number }> }> = {
  post: { label: "Posts", icon: FileText },
  news: { label: "News", icon: Newspaper },
  event: { label: "Calendar", icon: CalendarDays },
  poll: { label: "Polls", icon: Vote },
  thread: { label: "Forum", icon: MessagesSquare },
};

/** The strip along the top of a card on the front page: which part of the site it's from. */
export function CardSection({ kind }: { kind: SectionKind }) {
  const t = useT();
  const s = SECTIONS[kind];
  const Icon = s.icon;
  return (
    <div className={`card-section ${kind}`}>
      <Icon size={13} /> {t(s.label)}
    </div>
  );
}
