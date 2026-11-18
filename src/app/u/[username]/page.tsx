import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { summary, userByName } from "@/lib/users";
import { stats } from "@/lib/profile";
import { feed } from "@/lib/feed";
import { listGroups } from "@/lib/groups";
import { db } from "@/lib/db";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { Feed } from "@/components/feed/Feed";
import { FeedFilterCard, FeedScope } from "@/components/feed/FeedFilters";
import { getSettings } from "@/lib/settings";
import { homeLayout, pageColumn } from "@/lib/homePanels";
import { RichText } from "@/components/content/RichText";
import { BackPill } from "@/components/ui/BackPill";
import { requestT } from "@/lib/t";
import { bggMode } from "@/lib/bgg";
import { shelfAccount, shelfGames } from "@/lib/bggShelf";
import { GameShelf, ShelfCard, ShelfInvite } from "@/components/profile/GameShelf";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const p = userByName(decodeURIComponent((await params).username));
  return { title: p ? p.name : (await requestT())("Member") };
}

export default async function ProfilePage({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ tab?: string }> }) {
  const u = await requireUser();
  const t = await requestT();
  const p = userByName(decodeURIComponent((await params).username));
  if (!p || (p.banned && !u.isAdmin)) notFound();
  // their game shelf (the board games they own on BoardGameGeek): a tab of its own, and a few in the side column
  const shelf = shelfAccount(p.id);
  const shelved = shelf?.status === "ok" ? shelf.games : 0;
  const home = `/u/${encodeURIComponent(p.username)}`;
  const onShelf = shelved > 0 && (await searchParams).tab === "games";
  // the groups they're in that you can see
  const theirs = new Set((db().prepare("select group_id from group_members where user_id = ?").all(p.id) as { group_id: number }[]).map((r) => r.group_id));
  const { mine, others } = listGroups(u);
  const groups = [...mine, ...others].filter((g) => theirs.has(g.id) && g.privacy !== "secret");
  // the side column's parts, in order, and the feed's filters above it, among them, or none (Admin → Front page)
  const col = pageColumn(homeLayout(getSettings().home).profile);
  const aside = col.filters === "side";
  const parts = col.side
    .map((id) => {
      switch (id) {
        case "filters":
          return <FeedFilterCard key="filters" />;
        case "about":
          return (
            <section key="about" className="panel panel-pad">
              <span className="eyebrow">{t("About")}</span>
              <div style={{ marginTop: 10 }}>{p.bioHtml ? <RichText html={p.bioHtml} /> : <p className="small muted" style={{ margin: 0 }}>{t("Nothing here yet.")}</p>}</div>
            </section>
          );
        case "games":
          if (shelved) return <ShelfCard key="games" games={shelfGames(p.id, 9)} total={shelved} href={`${home}?tab=games`} />;
          // (their own profile: how to get one)
          return p.id === u.id && bggMode() === "full" ? <ShelfInvite key="games" pending={shelf?.status === "pending"} /> : null;
        case "groups":
          return groups.length ? (
            <section key="groups" className="panel">
              <div className="panel-head">
                <span className="eyebrow">{t("Groups")}</span>
              </div>
              <div className="list">
                {groups.map((g) => (
                  <Link key={g.id} href={`/groups/${g.slug}`} className="list-row">
                    <span className="group-avatar" style={{ ["--gc" as string]: g.color, backgroundImage: g.avatar ? `url("${g.avatar}")` : undefined }}>
                      {g.avatar ? "" : g.name.slice(0, 1)}
                    </span>
                    <b className="grow ellipsis">{g.name}</b>
                  </Link>
                ))}
              </div>
            </section>
          ) : null;
      }
    })
    .filter(Boolean);
  return (
    <div className="page">
      <BackPill href="/members" label={t("Members")} />
      <ProfileHeader
        p={{ ...summary(p), banner: p.banner, pronouns: p.pronouns, location: p.location, website: p.website, birthday: p.birthday, createdAt: p.createdAt, lastSeen: p.lastSeen, stats: stats(p.id) }}
      />
      {shelved ? (
        <nav className="tabs" style={{ marginTop: 16 }}>
          <Link href={home} className={onShelf ? "" : "active"}>
            {t("Activity")}
          </Link>
          <Link href={`${home}?tab=games`} className={onShelf ? "active" : ""}>
            {t("Game shelf")} <span className="n">{shelved}</span>
          </Link>
        </nav>
      ) : null}
      {onShelf ? (
        <div style={{ marginTop: 18 }}>
          <GameShelf games={shelfGames(p.id)} whose={{ kind: "member", owner: p.name.split(" ")[0], bggName: shelf?.username ?? "", fetchedAt: shelf?.fetchedAt ?? null }} />
        </div>
      ) : (
      <FeedScope>
        {/* (the eyebrow and the filters above the feed: the rows above its first card, which the side column starts level with) */}
        <div className={parts.length ? "with-side feed-cols" : "stack"} style={{ marginTop: 18, ["--feed-head-rows" as string]: col.filters === "middle" ? 2 : 1 }}>
          <div className="stack feed-main" style={{ minWidth: 0 }}>
            <span className="eyebrow">{t("What {name} has been up to", { name: p.name.split(" ")[0] })}</span>
            <Feed initial={feed(u, { authorId: p.id })} groups={[]} composer={false} authorId={p.id} showFilters={!!col.filters} filtersAside={aside} />
          </div>
          {parts.length ? <aside className="stack side-sticky">{parts}</aside> : null}
        </div>
      </FeedScope>
      )}
    </div>
  );
}
