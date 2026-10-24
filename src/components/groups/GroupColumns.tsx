import { upcoming } from "@/lib/events";
import { groupInfo, type GroupRow } from "@/lib/groups";
import { getSettings } from "@/lib/settings";
import type { User } from "@/lib/users";
import { MembersWidget, UpcomingWidget } from "@/components/home/Widgets";

/**
 * A group's tab beside its side column, as wide as the group's header above: what's coming up, and
 * who's in it (left out on the members tab, which lists them all). Like a profile, the side column
 * only shows beside the tab on a wide screen. Nothing to show: the tab takes the whole width.
 * The side column starts level with the tab's first frame: buttons go in `top`, above both; a feed
 * that starts with its filters says so with `feedHead` (the rows above its first card).
 */
export function GroupColumns({ u, g, members = true, top, feedHead, children }: { u: User; g: GroupRow; members?: boolean; top?: React.ReactNode; feedHead?: number; children: React.ReactNode }) {
  const slug = encodeURIComponent(g.slug);
  const calendar = getSettings().features.calendar;
  const info = members ? groupInfo(u, g, true) : null;
  const head = top ? <div className="row wrap">{top}</div> : null;
  if (!calendar && !info)
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
        <aside className="stack side-sticky group-side">
          {calendar ? <UpcomingWidget events={upcoming(u, 4, { groupId: g.id })} href={`/groups/${slug}/events`} planHref={`/events/new?group=${g.id}`} /> : null}
          {info ? <MembersWidget members={info.members} count={info.memberCount} href={`/groups/${slug}/members`} /> : null}
        </aside>
      </div>
    </div>
  );
}
