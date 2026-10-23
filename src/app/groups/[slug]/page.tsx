import { requireUser } from "@/lib/auth";
import { canPostInGroup, canReadGroup, groupRow } from "@/lib/groups";
import { feed } from "@/lib/feed";
import { Feed } from "@/components/feed/Feed";

export const dynamic = "force-dynamic";

export default async function GroupPosts({ params }: { params: Promise<{ slug: string }> }) {
  const u = await requireUser();
  const g = groupRow(decodeURIComponent((await params).slug));
  if (!g || !canReadGroup(u, g)) return null;
  return (
    <div className="narrow-col">
      <Feed initial={feed(u, { groupId: g.id })} groups={[{ id: g.id, name: g.name }]} groupId={g.id} composer={canPostInGroup(u, g)} />
    </div>
  );
}
