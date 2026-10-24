import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManageGroup, groupInfo, groupRole, groupRow } from "@/lib/groups";
import { GroupForm } from "@/components/groups/GroupForm";
import { DeleteGroup } from "@/components/groups/DeleteGroup";
import { GroupColumns } from "@/components/groups/GroupColumns";

export const dynamic = "force-dynamic";

export default async function GroupSettings({ params }: { params: Promise<{ slug: string }> }) {
  const u = await requireUser();
  const row = groupRow(decodeURIComponent((await params).slug));
  if (!row) return null;
  if (!canManageGroup(u, row)) redirect(`/groups/${row.slug}`);
  return (
    <GroupColumns u={u} g={row}>
      <div className="panel panel-pad">
        <GroupForm group={groupInfo(u, row)} />
      </div>
      {groupRole(row.id, u.id) === "owner" || u.isAdmin ? <DeleteGroup id={row.id} name={row.name} /> : null}
    </GroupColumns>
  );
}
