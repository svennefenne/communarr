import Link from "next/link";
import { CalendarDays, FileText, MessagesSquare, UsersRound, Vote } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { requestT } from "@/lib/t";
import { listPosts } from "@/lib/posts";
import { threads } from "@/lib/forum";
import { listPolls } from "@/lib/polls";
import { eventsBetween } from "@/lib/events";
import { listGroups } from "@/lib/groups";
import { PostCard } from "@/components/feed/PostCard";
import { PollCard } from "@/components/feed/PollCard";
import { EventCard } from "@/components/feed/EventCard";
import { ThreadList } from "@/components/forum/ThreadList";
import { Empty } from "@/components/ui/ui";

export async function generateMetadata() {
  return { title: (await requestT())("My stuff") };
}
export const dynamic = "force-dynamic";

const TABS = [
  ["posts", "Posts", FileText],
  ["threads", "Forum", MessagesSquare],
  ["polls", "Polls", Vote],
  ["events", "Events", CalendarDays],
  ["groups", "Groups", UsersRound],
] as const;

export default async function MyStuff({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const u = await requireUser();
  const t = await requestT();
  const { tab = "posts" } = await searchParams;
  return (
    <div className="page mid">
      <div className="page-head">
        <div>
          <span className="eyebrow">{t("Everything you made")}</span>
          <h1 className="display page-title">{t("My stuff")}</h1>
        </div>
      </div>
      <nav className="tabs">
        {TABS.map(([id, label, Icon]) => (
          <Link key={id} href={`/me?tab=${id}`} className={tab === id ? "active" : ""}>
            <Icon size={15} /> {t(label)}
          </Link>
        ))}
      </nav>
      <div className="stack loose narrow-col">
        {tab === "posts"
          ? (() => {
              const list = listPosts(u, { authorId: u.id, includePrivate: true, limit: 100 });
              return list.length ? list.map((p) => <PostCard key={p.id} post={p} />) : <Empty icon={<FileText size={24} />} title={t("No posts yet")}>{t("Write one on the front page. Posts set to “Only me” show up here too.")}</Empty>;
            })()
          : null}
        {tab === "threads"
          ? (() => {
              const list = threads(u, { authorId: u.id, sort: "new", limit: 100 }).list;
              return list.length ? <ThreadList threads={list} showCategory /> : <Empty icon={<MessagesSquare size={24} />} title={t("No threads yet")} />;
            })()
          : null}
        {tab === "polls"
          ? (() => {
              const list = listPolls(u, { authorId: u.id, limit: 100 });
              return list.length ? list.map((p) => <PollCard key={p.id} poll={p} />) : <Empty icon={<Vote size={24} />} title={t("No polls yet")} />;
            })()
          : null}
        {tab === "events"
          ? (() => {
              const list = eventsBetween(u, Date.now() - 365 * 86_400_000, Date.now() + 366 * 86_400_000, { mineOnly: true }).filter((e, i, a) => a.findIndex((x) => x.id === e.id) === i);
              return list.length ? list.map((e) => <EventCard key={e.id} event={e} />) : <Empty icon={<CalendarDays size={24} />} title={t("Nothing planned")}>{t("Events you plan or say you're going to show up here.")}</Empty>;
            })()
          : null}
        {tab === "groups"
          ? (() => {
              const list = listGroups(u).mine;
              return list.length ? (
                <div className="panel list">
                  {list.map((g) => (
                    <Link key={g.id} href={`/groups/${g.slug}`} className="list-row">
                      <span className="group-avatar" style={{ ["--gc" as string]: g.color, backgroundImage: g.avatar ? `url("${g.avatar}")` : undefined }}>
                        {g.avatar ? "" : g.name.slice(0, 1)}
                      </span>
                      <span className="grow">
                        <b>{g.name}</b>
                        <span className="tiny muted" style={{ display: "block" }}>
                          {g.myRole ? t(g.myRole) : ""} · {t.n(g.memberCount, "{n} member", "{n} members")}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <Empty icon={<UsersRound size={24} />} title={t("No groups yet")} />
              );
            })()
          : null}
      </div>
    </div>
  );
}
