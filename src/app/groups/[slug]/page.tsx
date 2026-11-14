import { requireUser } from "@/lib/auth";
import { canPostInGroup, canReadGroup, groupRow } from "@/lib/groups";
import { feed } from "@/lib/feed";
import { Feed } from "@/components/feed/Feed";
import { GroupColumns } from "@/components/groups/GroupColumns";
import { FeedFilterCard, FeedScope } from "@/components/feed/FeedFilters";
import { getSettings } from "@/lib/settings";
import { homeLayout, pageColumn } from "@/lib/homePanels";

export const dynamic = "force-dynamic";

export default async function GroupPosts({ params }: { params: Promise<{ slug: string }> }) {
  const u = await requireUser();
  const g = groupRow(decodeURIComponent((await params).slug));
  if (!g || !canReadGroup(u, g)) return null;
  const composer = canPostInGroup(u, g);
  // the feed's filters above it, in the side column, or none (Admin → Front page)
  const { filters } = pageColumn(homeLayout(getSettings().home).group);
  const aside = filters === "side";
  return (
    <FeedScope>
      {/* (without the composer the feed starts with its filters: one row above the first card) */}
      <GroupColumns u={u} g={g} feedHead={composer || filters !== "middle" ? undefined : 1} filters={aside ? <FeedFilterCard groupId={g.id} /> : undefined}>
        <Feed initial={feed(u, { groupId: g.id })} groups={[{ id: g.id, name: g.name }]} groupId={g.id} composer={composer} showFilters={!!filters} filtersAside={aside} />
      </GroupColumns>
    </FeedScope>
  );
}
