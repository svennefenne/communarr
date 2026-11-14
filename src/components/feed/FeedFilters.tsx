"use client";

import { createContext, useContext, useRef, useState } from "react";
import { CalendarDays, FileText, Layers, ListChecks, ListFilter, MessagesSquare, Newspaper, Vote } from "lucide-react";
import type { FeedFilter } from "@/lib/contentTypes";
import type { Features } from "@/lib/bootTypes";
import type { FeedKind } from "@/lib/homePanels";
import { useApp, useT } from "@/components/app/AppProvider";
import { Widget } from "@/components/home/Widgets";

/** A feed's filters: what's in it, by kind. */
export const FEED_FILTERS: { id: FeedFilter; label: string; icon: React.ComponentType<{ size?: number }>; feature?: "forum" | "polls" | "calendar" | "news" | "lists" }[] = [
  { id: "all", label: "Everything", icon: Layers },
  { id: "posts", label: "Posts", icon: FileText },
  { id: "news", label: "News", icon: Newspaper, feature: "news" },
  { id: "forum", label: "Forum", icon: MessagesSquare, feature: "forum" },
  { id: "polls", label: "Polls", icon: Vote, feature: "polls" },
  { id: "events", label: "Events", icon: CalendarDays, feature: "calendar" },
  { id: "lists", label: "Lists", icon: ListChecks, feature: "lists" },
];

/** The filters a feed has: the kinds whose feature is on, of its kinds (the front page's), and no news in a group's (news is for everyone). */
export function feedFilters(features: Features, o: { groupId?: number; kinds?: FeedKind[] } = {}) {
  return FEED_FILTERS.filter((f) => (!f.feature || features[f.feature]) && !(o.groupId && f.id === "news") && (f.id === "all" || !o.kinds || o.kinds.includes(f.id)));
}

interface Scope {
  filter: FeedFilter;
  setFilter: (f: FeedFilter) => void;
  /** the feed's list, to go back up to when a filter's chosen far down it */
  body: React.RefObject<HTMLDivElement | null>;
}

const ScopeCtx = createContext<Scope | null>(null);

/** the filter a feed and its card in a side column share (none: the feed keeps its own) */
export const useFeedScope = () => useContext(ScopeCtx);

/**
 * A feed whose filters can be elsewhere on the page, in a card in a side column (Admin → Front page):
 * the feed and the card choose together. Around both.
 */
export function FeedScope({ initial = "all", children }: { initial?: FeedFilter; children: React.ReactNode }) {
  const [filter, setFilter] = useState<FeedFilter>(initial);
  const body = useRef<HTMLDivElement | null>(null);
  return <ScopeCtx.Provider value={{ filter, setFilter, body }}>{children}</ScopeCtx.Provider>;
}

/**
 * The feed's filters as a card in a side column: one under the other, as a row of them doesn't fit
 * there. Only beside the feed on a wide screen: on a narrower one the feed has them above it again.
 */
export function FeedFilterCard({ groupId, kinds }: { groupId?: number; kinds?: FeedKind[] }) {
  const scope = useFeedScope();
  const { site } = useApp();
  const t = useT();
  const filters = feedFilters(site.features, { groupId, kinds });
  // (one kind only: nothing to choose between)
  if (!scope || filters.length < 3) return null;
  const choose = (f: FeedFilter) => {
    if (f === scope.filter) return;
    scope.setFilter(f);
    // chosen far down the feed: back up to its start, where the new list begins
    const el = scope.body.current;
    if (!el) return;
    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 0;
    const above = el.getBoundingClientRect().top - header - 16;
    if (above < 0) window.scrollBy({ top: above, behavior: "smooth" });
  };
  return (
    <Widget title={t("Show")} icon={<ListFilter size={14} />} className="feed-filter-card">
      <div className="feed-filter-list" role="tablist" aria-orientation="vertical" aria-label={t("Show")}>
        {filters.map((f) => {
          const Icon = f.icon;
          const on = scope.filter === f.id;
          return (
            <button key={f.id} type="button" role="tab" aria-selected={on} className={`feed-filter-row ${on ? "active" : ""}`} onClick={() => choose(f.id)}>
              <Icon size={15} />
              <span className="grow ellipsis">{t(f.label)}</span>
            </button>
          );
        })}
      </div>
    </Widget>
  );
}
