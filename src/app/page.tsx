import { Fragment } from "react";
import { requireUser } from "@/lib/auth";
import { feed } from "@/lib/feed";
import { latestNews, listPosts } from "@/lib/posts";
import { countdownFor, eventsBetween, upcoming } from "@/lib/events";
import { roomsFor } from "@/lib/chat";
import { latestThreads } from "@/lib/forum";
import { listPolls } from "@/lib/polls";
import { listLists } from "@/lib/lists";
import { listGroups, postableGroups } from "@/lib/groups";
import { allMembers } from "@/lib/users";
import { getSettings } from "@/lib/settings";
import { FEED_FEATURE, filtersPlace, homeLayout, shownPanels, type FeedKind, type HomePanel } from "@/lib/homePanels";
import { monthGrid, monthKey } from "@/lib/monthGrid";
import type { FeedFilter } from "@/lib/contentTypes";
import { Feed } from "@/components/feed/Feed";
import { FeedFilterCard, FeedScope } from "@/components/feed/FeedFilters";
import { Announcement } from "@/components/shell/Announcement";
import { PushPrompt } from "@/components/home/PushPrompt";
import { ChatWidget, ForumWidget, Greeting, GroupsWidget, ListsWidget, MobileStrip, NewsHero, NewsWidget, OnlineWidget, PollsWidget, UpcomingWidget } from "@/components/home/Widgets";
import { MonthWidget } from "@/components/home/MonthWidget";
import { CountdownHead } from "@/components/home/Countdown";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const u = await requireUser();
  const { show } = await searchParams;
  const s = getSettings();
  const f = s.features;
  // the side columns and what the feed shows (Admin → Front page): only what's shown is looked up
  const layout = homeLayout(s.home);
  const kinds = layout.feed;
  const filter = show === "all" || kinds.includes(show as FeedKind) ? (show as FeedFilter) : "all";
  const items = feed(u, { filter, kinds });
  const news = layout.hero ? latestNews(u, 1)[0] : undefined;
  // the hero shows pinned news, or news from the last week
  const hero = news && (news.pinned || Date.now() - news.createdAt < 7 * 86_400_000) ? news : null;
  const members = allMembers();
  const others = members.filter((m) => m.id !== u.id);
  // the feed's filters: above it, in a side column, or none (one kind only: nothing to choose between)
  const filters = kinds.filter((k) => !FEED_FEATURE[k] || f[FEED_FEATURE[k]!]).length > 1 ? filtersPlace(layout) : null;
  const all = shownPanels(layout, f);
  const sides = filters ? all : { left: all.left.filter((id) => id !== "filters"), right: all.right.filter((id) => id !== "filters") };
  const shown = new Set([...sides.left, ...sides.right]);
  // (what's coming up is the phone's strip too)
  const events = f.calendar ? upcoming(u, 5) : [];
  // an event counting down: the heading (instead of the greeting)
  const countdown = f.calendar ? countdownFor(u) : null;
  const month = (() => {
    if (!shown.has("calendar") || layout.calendar !== "month") return null;
    const m = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const g = monthGrid(m, s);
    return { month: monthKey(m), events: eventsBetween(u, g.from.getTime(), g.to.getTime()) };
  })();
  const panel = (id: HomePanel) => {
    switch (id) {
      case "filters":
        return <FeedFilterCard kinds={kinds} />;
      case "calendar":
        return month ? <MonthWidget initial={month} /> : <UpcomingWidget events={events} />;
      case "online":
        return <OnlineWidget members={others} />;
      case "chat":
        return <ChatWidget rooms={roomsFor(u).mine.slice(0, 6)} />;
      case "forum":
        return <ForumWidget threads={latestThreads(u, 5)} />;
      case "polls":
        return <PollsWidget polls={listPolls(u, { state: "open", limit: 12 }).filter((p) => !p.voted).slice(0, 3)} />;
      case "lists":
        return <ListsWidget lists={listLists(u, { limit: 5 })} />;
      case "groups":
        return <GroupsWidget groups={listGroups(u).mine.slice(0, 6)} />;
      case "news":
        return <NewsWidget posts={listPosts(u, { kind: "news", limit: 10 })} />;
    }
  };
  const column = (ids: HomePanel[], cls: string) =>
    ids.length ? (
      <aside className={`stack ${cls}`}>
        {ids.map((id) => (
          <Fragment key={id}>{panel(id)}</Fragment>
        ))}
      </aside>
    ) : null;
  return (
    <div className={`page home sides-${sides.left.length && sides.right.length ? "both" : sides.left.length ? "left" : sides.right.length ? "right" : "none"}`}>
      <div className="page-head home-head">
        {countdown ? (
          <CountdownHead
            name={u.name}
            e={{ id: countdown.id, title: countdown.title, startAt: countdown.startAt, endAt: countdown.endAt, allDay: countdown.allDay, going: countdown.going }}
            now={Date.now()}
          />
        ) : (
          <Greeting name={u.name} />
        )}
      </div>
      <MobileStrip events={events} members={others} />
      {/* the feed between the side columns (on a narrower screen, all of them on the right: the left
          one's parts last; on a phone, the strip above instead) */}
      <FeedScope initial={filter}>
        <div className={`home-cols ${sides.left.length ? "has-left" : ""} ${sides.right.length ? "has-right" : ""}`}>
          <div className="stack loose home-main" data-middle>
            {/* (the announcement as wide as the feed, on a wide screen; a narrower one has it on top) */}
            <Announcement inPage />
            <PushPrompt />
            {hero && filter === "all" ? <NewsHero post={hero} /> : null}
            <Feed
              initial={items}
              initialFilter={filter}
              groups={postableGroups(u)}
              sections
              stickyFilters
              kinds={kinds}
              showFilters={!!filters}
              filtersAside={filters === "left" || filters === "right"}
            />
          </div>
          {shown.size ? (
            <div className="home-sides">
              {column(sides.left, "home-left")}
              {column(sides.right, "home-right")}
            </div>
          ) : null}
        </div>
      </FeedScope>
    </div>
  );
}
