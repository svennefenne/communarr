import { requireUser } from "@/lib/auth";
import { canPostInGroup, canReadGroup, groupRow } from "@/lib/groups";
import { feed } from "@/lib/feed";
import { Feed } from "@/components/feed/Feed";
import { GroupColumns } from "@/components/groups/GroupColumns";
import { FeedFilterCard, FeedScope } from "@/components/feed/FeedFilters";
import { getSettings } from "@/lib/settings";
import { homeLayout } from "@/lib/homePanels";

export const dynamic = "force-dynamic";

export default async function GroupPosts({ params }: { params: Promise<{ slug: string }> }) {
  const u = await requireUser();
  const g = groupRow(decodeURIComponent((await params).slug));
  if (!g || !canReadGroup(u, g)) return null;
  const composer = canPostInGroup(u, g);
  // the feed's filters above it, or on top in the side column (Admin → Front page)
  const aside = homeLayout(getSettings().home).pageFilters === "side";
  return (
    <FeedScope>
      {/* (without the composer the feed starts with its filters: one row above the first card) */}
      <GroupColumns u={u} g={g} feedHead={composer || aside ? undefined : 1} sideTop={aside ? <FeedFilterCard groupId={g.id} /> : undefined}>
        <Feed initial={feed(u, { groupId: g.id })} groups={[{ id: g.id, name: g.name }]} groupId={g.id} composer={composer} filtersAside={aside} />
      </GroupColumns>
    </FeedScope>
  );
}
