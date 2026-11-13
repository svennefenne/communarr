import { Fragment } from "react";
import { requireUser } from "@/lib/auth";
import { feed } from "@/lib/feed";
import { latestNews } from "@/lib/posts";
import { eventsBetween, upcoming } from "@/lib/events";
import { roomsFor } from "@/lib/chat";
import { latestThreads } from "@/lib/forum";
import { listPolls } from "@/lib/polls";
import { listLists } from "@/lib/lists";
import { listGroups, postableGroups } from "@/lib/groups";
import { allMembers } from "@/lib/users";
import { getSettings } from "@/lib/settings";
import { homeLayout, shownPanels, type HomePanel } from "@/lib/homePanels";
import { monthGrid, monthKey } from "@/lib/monthGrid";
import type { FeedFilter } from "@/lib/contentTypes";
import { Feed } from "@/components/feed/Feed";
import { PushPrompt } from "@/components/home/PushPrompt";
import { ChatWidget, ForumWidget, Greeting, GroupsWidget, ListsWidget, MobileStrip, NewsHero, OnlineWidget, PollsWidget, UpcomingWidget } from "@/components/home/Widgets";
import { MonthWidget } from "@/components/home/MonthWidget";

export const dynamic = "force-dynamic";

const FILTERS: FeedFilter[] = ["all", "posts", "news", "forum", "polls", "events"];

export default async function Home({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const u = await requireUser();
  const { show } = await searchParams;
  const filter = FILTERS.includes(show as FeedFilter) ? (show as FeedFilter) : "all";
  const s = getSettings();
  const f = s.features;
  const items = feed(u, { filter });
  const news = latestNews(u, 1)[0];
  // the hero shows pinned news, or news from the last week
  const hero = news && (news.pinned || Date.now() - news.createdAt < 7 * 86_400_000) ? news : null;
  const members = allMembers();
  const others = members.filter((m) => m.id !== u.id);
  // the side columns (Admin → Front page): only what's in them is looked up
  const layout = homeLayout(s.home);
  const sides = shownPanels(layout, f);
  const shown = new Set([...sides.left, ...sides.right]);
  // (what's coming up is the phone's strip too)
  const events = f.calendar ? upcoming(u, 5) : [];
  const month = (() => {
    if (!shown.has("calendar") || layout.calendar !== "month") return null;
    const m = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const g = monthGrid(m, s);
    return { month: monthKey(m), events: eventsBetween(u, g.from.getTime(), g.to.getTime()) };
  })();
  const panel = (id: HomePanel) => {
    switch (id) {
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
    <div className="page home">
      <div className="page-head home-head">
        <Greeting name={u.name} />
      </div>
      <MobileStrip events={events} members={others} />
      {/* the feed between the side columns (on a narrower screen, all of them on the right: the left
          one's parts last; on a phone, the strip above instead) */}
      <div className={`home-cols ${sides.left.length ? "has-left" : ""} ${sides.right.length ? "has-right" : ""}`}>
        <div className="stack loose home-main">
          <PushPrompt />
          {hero && filter === "all" ? <NewsHero post={hero} /> : null}
          <Feed initial={items} initialFilter={filter} groups={postableGroups(u)} sections stickyFilters />
        </div>
        {shown.size ? (
          <div className="home-sides">
            {column(sides.left, "home-left")}
            {column(sides.right, "home-right")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
