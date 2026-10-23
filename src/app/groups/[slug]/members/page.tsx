import { requireUser } from "@/lib/auth";
import { canManageGroup, canReadGroup, groupMembers, groupRequests, groupRole, groupRow } from "@/lib/groups";
import { GroupMembers } from "@/components/groups/GroupMembers";

export const dynamic = "force-dynamic";

export default async function GroupMembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const u = await requireUser();
  const g = groupRow(decodeURIComponent((await params).slug));
  if (!g || !canReadGroup(u, g)) return null;
  const manage = canManageGroup(u, g);
  return <GroupMembers groupId={g.id} members={groupMembers(g.id)} requests={manage ? groupRequests(g.id) : []} canManage={manage} isOwner={groupRole(g.id, u.id) === "owner" || u.isAdmin} />;
}
