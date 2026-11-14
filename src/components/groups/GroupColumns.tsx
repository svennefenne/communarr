import { Fragment } from "react";
import { upcoming } from "@/lib/events";
import { groupInfo, type GroupRow } from "@/lib/groups";
import { homeLayout, pageColumn } from "@/lib/homePanels";
import { getSettings } from "@/lib/settings";
import type { User } from "@/lib/users";
import { MembersWidget, UpcomingWidget } from "@/components/home/Widgets";

/**
 * A group's tab beside its side column, as wide as the group's header above: what's coming up, and
 * who's in it (left out on the members tab, which lists them all), in the order and as many as Admin →
 * Front page says. Like a profile, the side column only shows beside the tab on a wide screen.
 * Nothing to show: the tab takes the whole width.
 * The side column starts level with the tab's first frame: buttons go in `top`, above both; a feed
 * that starts with its filters says so with `feedHead` (the rows above its first card). `filters` is
 * the feed's filters' card, for its place in the side column (the posts tab, when they're there).
 */
export function GroupColumns({
  u,
  g,
  members = true,
  top,
  feedHead,
  filters,
  children,
}: {
  u: User;
  g: GroupRow;
  members?: boolean;
  top?: React.ReactNode;
  feedHead?: number;
  filters?: React.ReactNode;
  children: React.ReactNode;
}) {
  const slug = encodeURIComponent(g.slug);
  const s = getSettings();
  const { side } = pageColumn(homeLayout(s.home).group);
  const info = members && side.includes("members") ? groupInfo(u, g, true) : null;
  const parts = side
    .map((id) => {
      switch (id) {
        case "filters":
          return filters ? <Fragment key="filters">{filters}</Fragment> : null;
        case "upcoming":
          return s.features.calendar ? <UpcomingWidget key="upcoming" events={upcoming(u, 4, { groupId: g.id })} href={`/groups/${slug}/events`} planHref={`/events/new?group=${g.id}`} /> : null;
        case "members":
          return info ? <MembersWidget key="members" members={info.members} count={info.memberCount} href={`/groups/${slug}/members`} /> : null;
      }
    })
    .filter(Boolean);
  const head = top ? <div className="row wrap">{top}</div> : null;
  if (!parts.length)
    return (
      <div className="stack loose">
        {head}
        {children}
      </div>
    );
  return (
    <div className="stack loose">
      {head}
      <div className={`with-side group-cols ${feedHead ? "feed-cols" : ""}`} style={feedHead ? { ["--feed-head-rows" as string]: feedHead } : undefined}>
        <div className="stack loose feed-main" style={{ minWidth: 0 }}>
          {children}
        </div>
        <aside className="stack side-sticky group-side">{parts}</aside>
      </div>
    </div>
  );
}
