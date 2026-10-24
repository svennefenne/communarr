"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, CalendarDays, FileText, Layers, MessagesSquare, Newspaper, Vote } from "lucide-react";
import type { FeedFilter, FeedItem } from "@/lib/contentTypes";
import { useApp, useLive, useT } from "@/components/app/AppProvider";
import { Empty } from "@/components/ui/ui";
import { PostCard } from "./PostCard";
import { PollCard } from "./PollCard";
import { EventCard } from "./EventCard";
import { ThreadFeedCard } from "./ThreadCard";
import { Composer, type ComposerGroup } from "./Composer";
import { feedAction } from "@/app/actions/content";

const FILTERS: { id: FeedFilter; label: string; icon: React.ComponentType<{ size?: number }>; feature?: "forum" | "polls" | "calendar" | "news" }[] = [
  { id: "all", label: "Everything", icon: Layers },
  { id: "posts", label: "Posts", icon: FileText },
  { id: "news", label: "News", icon: Newspaper, feature: "news" },
  { id: "forum", label: "Forum", icon: MessagesSquare, feature: "forum" },
  { id: "polls", label: "Polls", icon: Vote, feature: "polls" },
  { id: "events", label: "Events", icon: CalendarDays, feature: "calendar" },
];

export function FeedItemView({ item }: { item: FeedItem }) {
  switch (item.type) {
    case "post":
      return <PostCard post={item.post} />;
    case "poll":
      return <PollCard poll={item.poll} />;
    case "event":
      return <EventCard event={item.event} />;
    case "thread":
      return <ThreadFeedCard thread={item.thread} />;
  }
}

const keyOf = (i: FeedItem) => `${i.type}-${i.type === "post" ? i.post.id : i.type === "poll" ? i.poll.id : i.type === "event" ? i.event.id : i.thread.id}`;

/** The feed with its filters, more as you scroll, and a pill when others post something new. */
export function Feed({
  initial,
  initialFilter = "all",
  groups,
  groupId,
  composer = true,
  showFilters = true,
  authorId,
}: {
  initial: { items: FeedItem[]; next: number | null };
  initialFilter?: FeedFilter;
  groups: ComposerGroup[];
  groupId?: number;
  composer?: boolean;
  showFilters?: boolean;
  /** only what this member made (their profile) */
  authorId?: number;
}) {
  const { site, me } = useApp();
  const t = useT();
  const [filter, setFilter] = useState<FeedFilter>(initialFilter);
  const [items, setItems] = useState(initial.items);
  const [next, setNext] = useState(initial.next);
  const [loading, setLoading] = useState(false);
  const [fresh, setFresh] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (f: FeedFilter, before?: number) => {
      setLoading(true);
      const r = await feedAction(f, before, groupId, authorId);
      setLoading(false);
      if (!r.ok) return;
      setItems((list) => (before ? [...list, ...r.data.items.filter((i) => !list.some((x) => keyOf(x) === keyOf(i)))] : r.data.items));
      setNext(r.data.next);
    },
    [groupId, authorId],
  );

  const choose = (f: FeedFilter) => {
    setFilter(f);
    setFresh(0);
    const url = new URL(window.location.href);
    if (f === "all") url.searchParams.delete("show");
    else url.searchParams.set("show", f);
    window.history.replaceState(window.history.state, "", url);
    void load(f);
  };

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next) return;
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting && !loading && next) void load(filter, next);
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [next, loading, filter, load]);

  useLive("feed", (d) => {
    const e = d as { by: number; group: number | null };
    if (e.by === me?.id) return;
    if (groupId && e.group !== groupId) return;
    if (authorId && e.by !== authorId) return;
    setFresh((n) => n + 1);
  });

  // (news is for everyone: not a group's)
  const filters = FILTERS.filter((f) => (!f.feature || site.features[f.feature]) && !(groupId && f.id === "news"));
  return (
    <div className="feed">
      {composer ? (
        <Composer
          groups={groups}
          groupId={groupId}
          onPosted={() => {
            setFresh(0);
            void load(filter);
          }}
        />
      ) : null}
      {showFilters ? (
        <div className="pills scroll feed-filters" role="tablist" aria-label={t("Show")}>
          {filters.map((f) => {
            const Icon = f.icon;
            return (
              <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className={`pill ${filter === f.id ? "active" : ""}`} onClick={() => choose(f.id)}>
                <Icon size={14} /> {t(f.label)}
              </button>
            );
          })}
        </div>
      ) : null}
      {/* the items (with the "new things" pill over them): a page can line its side column up with this */}
      <div className="feed-body">
        {fresh ? (
          <button
            type="button"
            className="fresh-pill"
            onClick={() => {
              setFresh(0);
              void load(filter);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <ArrowUp size={15} /> {t.n(fresh, "{n} new thing", "{n} new things")}
          </button>
        ) : null}
        <div className={`stack feed-list ${loading && !items.length ? "loading" : ""}`}>
          {items.map((i) => (
            <FeedItemView key={keyOf(i)} item={i} />
          ))}
          {!items.length && !loading ? (
            <Empty icon={<Layers size={24} />} title={t("Nothing here yet")}>
              {t(filter === "all" ? "Say something! Everything people post, plan and ask shows up here." : "Nothing of this kind yet.")}
            </Empty>
          ) : null}
          {loading ? (
            <div className="stack">
              <div className="skeleton" style={{ height: 140 }} />
              <div className="skeleton" style={{ height: 140 }} />
            </div>
          ) : null}
          <div ref={sentinel} />
          {!next && items.length > 4 ? <div className="feed-end mono small faint">· {t("THAT'S EVERYTHING")} ·</div> : null}
        </div>
      </div>
    </div>
  );
}
