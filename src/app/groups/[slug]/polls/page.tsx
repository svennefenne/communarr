import Link from "next/link";
import { Plus, Vote } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { canPostInGroup, canReadGroup, groupRow } from "@/lib/groups";
import { listPolls } from "@/lib/polls";
import { PollCard } from "@/components/feed/PollCard";
import { Empty } from "@/components/ui/ui";
import { requestT } from "@/lib/t";
import { GroupColumns } from "@/components/groups/GroupColumns";

export const dynamic = "force-dynamic";

export default async function GroupPolls({ params }: { params: Promise<{ slug: string }> }) {
  const u = await requireUser();
  const t = await requestT();
  const g = groupRow(decodeURIComponent((await params).slug));
  if (!g || !canReadGroup(u, g)) return null;
  const polls = listPolls(u, { groupId: g.id, limit: 60 });
  return (
    <GroupColumns
      u={u}
      g={g}
      top={
        canPostInGroup(u, g) ? (
          <Link href={`/polls/new?group=${g.id}`} className="btn btn-primary">
            <Plus size={16} /> {t("New poll in {name}", { name: g.name })}
          </Link>
        ) : null
      }
    >
      {polls.map((p) => (
        <PollCard key={p.id} poll={p} />
      ))}
      {!polls.length ? <Empty icon={<Vote size={24} />} title={t("No polls in this group yet")} /> : null}
    </GroupColumns>
  );
}
