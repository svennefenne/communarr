import { requireUser } from "@/lib/auth";
import { feed } from "@/lib/feed";
import { latestNews } from "@/lib/posts";
import { upcoming } from "@/lib/events";
import { roomsFor } from "@/lib/chat";
import { latestThreads } from "@/lib/forum";
import { listPolls } from "@/lib/polls";
import { listGroups, postableGroups } from "@/lib/groups";
import { allMembers } from "@/lib/users";
import { getSettings } from "@/lib/settings";
import type { FeedFilter } from "@/lib/contentTypes";
import { Feed } from "@/components/feed/Feed";
import { PushPrompt } from "@/components/home/PushPrompt";
import { ChatWidget, ForumWidget, Greeting, GroupsWidget, MobileStrip, NewsHero, OnlineWidget, PollsWidget, UpcomingWidget } from "@/components/home/Widgets";

export const dynamic = "force-dynamic";

const FILTERS: FeedFilter[] = ["all", "posts", "news", "forum", "polls", "events"];

export default async function Home({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const u = await requireUser();
  const { show } = await searchParams;
  const filter = FILTERS.includes(show as FeedFilter) ? (show as FeedFilter) : "all";
  const f = getSettings().features;
  const items = feed(u, { filter });
  const news = latestNews(u, 1)[0];
  // the hero shows pinned news, or news from the last week
  const hero = news && (news.pinned || Date.now() - news.createdAt < 7 * 86_400_000) ? news : null;
  const events = f.calendar ? upcoming(u, 5) : [];
  const rooms = f.chat ? roomsFor(u).mine.slice(0, 6) : [];
  const threads = f.forum ? latestThreads(u, 5) : [];
  const polls = f.polls ? listPolls(u, { state: "open", limit: 12 }).filter((p) => !p.voted).slice(0, 3) : [];
  const groups = f.groups ? listGroups(u).mine.slice(0, 6) : [];
  const members = allMembers();
  return (
    <div className="page home">
      <div className="page-head home-head">
        <Greeting name={u.name} />
      </div>
      <MobileStrip events={events} members={members.filter((m) => m.id !== u.id)} />
      <div className="with-side">
        <div className="stack loose" style={{ minWidth: 0 }}>
          <PushPrompt />
          {hero && filter === "all" ? <NewsHero post={hero} /> : null}
          <Feed initial={items} initialFilter={filter} groups={postableGroups(u)} />
        </div>
        <aside className="stack home-side side-sticky">
          {f.calendar ? <UpcomingWidget events={events} /> : null}
          {f.chat ? <ChatWidget rooms={rooms} /> : null}
          <OnlineWidget members={members.filter((m) => m.id !== u.id)} />
          <PollsWidget polls={polls} />
          {f.forum ? <ForumWidget threads={threads} /> : null}
          {f.groups ? <GroupsWidget groups={groups} /> : null}
        </aside>
      </div>
    </div>
  );
}
