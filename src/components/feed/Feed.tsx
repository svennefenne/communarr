"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Layers } from "lucide-react";
import type { FeedFilter, FeedItem } from "@/lib/contentTypes";
import { useApp, useLive, useT } from "@/components/app/AppProvider";
import { Empty } from "@/components/ui/ui";
import { PostCard } from "./PostCard";
import { PollCard } from "./PollCard";
import { EventCard } from "./EventCard";
import { ThreadFeedCard } from "./ThreadCard";
import { ListCardView } from "@/components/lists/ListCard";
import { Composer, type ComposerGroup } from "./Composer";
import { feedAction } from "@/app/actions/content";
import type { FeedKind } from "@/lib/homePanels";
import { feedFilters, useFeedScope } from "./FeedFilters";

/** what a "feed" message from the server says came, as the feed's kind */
const LIVE_KIND: Record<string, FeedKind> = { post: "posts", news: "news", thread: "forum", poll: "polls", event: "events", list: "lists" };

/** One thing in the feed; section: a strip on top saying which part of the site it's from (the front page). */
export function FeedItemView({ item, section = false }: { item: FeedItem; section?: boolean }) {
  switch (item.type) {
    case "post":
      return <PostCard post={item.post} section={section} />;
    case "poll":
      return <PollCard poll={item.poll} section={section} />;
    case "event":
      return <EventCard event={item.event} section={section} />;
    case "thread":
      return <ThreadFeedCard thread={item.thread} section={section} />;
    case "list":
      return <ListCardView list={item.list} section={section} />;
  }
}

const keyOf = (i: FeedItem) => `${i.type}-${i.type === "post" ? i.post.id : i.type === "poll" ? i.poll.id : i.type === "event" ? i.event.id : i.type === "list" ? i.list.id : i.thread.id}`;

/** The feed with its filters, more as you scroll, and a pill when others post something new. */
export function Feed({
  initial,
  initialFilter = "all",
  groups,
  groupId,
  composer = true,
  showFilters = true,
  sections = false,
  stickyFilters = false,
  authorId,
  kinds,
  filtersAside = false,
}: {
  initial: { items: FeedItem[]; next: number | null };
  initialFilter?: FeedFilter;
  groups: ComposerGroup[];
  groupId?: number;
  composer?: boolean;
  showFilters?: boolean;
  /** each card says which part of the site it's from (the front page) */
  sections?: boolean;
  /** on a phone the filters stay under the top bar as the feed scrolls (the front page) */
  stickyFilters?: boolean;
  /** only what this member made (their profile) */
  authorId?: number;
  /** only these kinds (the front page's, Admin → Front page) */
  kinds?: FeedKind[];
  /** its filters are in a card in the side column (FeedScope, FeedFilterCard): above it only on a narrower screen, which has no side column */
  filtersAside?: boolean;
}) {
  const { site, me } = useApp();
  const t = useT();
  // (a card in the side column chooses too: the scope's then)
  const scope = useFeedScope();
  const [own, setOwn] = useState<FeedFilter>(initialFilter);
  const filter = scope?.filter ?? own;
  const setFilter = scope?.setFilter ?? setOwn;
  const [items, setItems] = useState(initial.items);
  const [next, setNext] = useState(initial.next);
  const [loading, setLoading] = useState(false);
  const [fresh, setFresh] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  const load = useCallback(
    async (f: FeedFilter, before?: number) => {
      setLoading(true);
      const r = await feedAction(f, before, groupId, authorId, kinds);
      setLoading(false);
      if (!r.ok) return;
      setItems((list) => (before ? [...list, ...r.data.items.filter((i) => !list.some((x) => keyOf(x) === keyOf(i)))] : r.data.items));
      setNext(r.data.next);
    },
    [groupId, authorId, kinds],
  );

  // a filter chosen (here, or in the side column's card): its list, from the start, and the address says which
  const listed = useRef(filter);
  useEffect(() => {
    if (listed.current === filter) return;
    listed.current = filter;
    setFresh(0);
    const url = new URL(window.location.href);
    if (filter === "all") url.searchParams.delete("show");
    else url.searchParams.set("show", filter);
    window.history.replaceState(window.history.state, "", url);
    void load(filter);
  }, [filter, load]);

  const choose = (f: FeedFilter) => {
    // chosen up under the top bar: the new list from its start (where it is when the filters just get there)
    const el = bar.current;
    if (stuck && el && body.current) {
      const below = parseFloat(getComputedStyle(el).marginBottom) + parseFloat(getComputedStyle(el.parentElement!).rowGap);
      window.scrollBy({ top: body.current.getBoundingClientRect().top - el.getBoundingClientRect().bottom - below });
    }
    // (the one already chosen: anew)
    if (f === filter) {
      setFresh(0);
      void load(f);
    } else setFilter(f);
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

  // the filters once they've reached the top bar and stay there (sticky only on a phone, in feed.css)
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      const css = getComputedStyle(el);
      setStuck(css.position === "sticky" && el.getBoundingClientRect().top <= parseFloat(css.top) + 0.5);
    };
    const later = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", later, { passive: true });
    window.addEventListener("resize", later);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", later);
      window.removeEventListener("resize", later);
    };
  }, [showFilters, stickyFilters]);

  useLive("feed", (d) => {
    const e = d as { type: string; by: number; group: number | null };
    if (e.by === me?.id) return;
    if (kinds && !kinds.includes(LIVE_KIND[e.type])) return;
    if (groupId && e.group !== groupId) return;
    if (authorId && e.by !== authorId) return;
    setFresh((n) => n + 1);
  });

  const filters = feedFilters(site.features, { groupId, kinds });
  const pills = (
    <div className={`pills scroll feed-filters ${filtersAside && !stickyFilters ? "aside-wide" : ""}`} role="tablist" aria-label={t("Show")}>
      {filters.map((f) => {
        const Icon = f.icon;
        return (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className={`pill ${filter === f.id ? "active" : ""}`} onClick={() => choose(f.id)}>
            <Icon size={14} /> {t(f.label)}
          </button>
        );
      })}
    </div>
  );
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
      {/* (one kind only: nothing to choose between) */}
      {showFilters && filters.length < 3 ? null : showFilters && stickyFilters ? (
        <div ref={bar} className={`feed-filters-bar ${stuck ? "stuck" : ""} ${filtersAside ? "aside-wide" : ""}`}>
          {pills}
        </div>
      ) : showFilters ? (
        pills
      ) : null}
      {/* the items (with the "new things" pill over them): a page can line its side column up with this */}
      <div
        className="feed-body"
        ref={(el) => {
          body.current = el;
          if (scope) scope.body.current = el;
        }}
      >
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
            <FeedItemView key={keyOf(i)} item={i} section={sections} />
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
