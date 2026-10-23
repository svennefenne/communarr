import Link from "next/link";
import { Plus, Vote } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { canPostInGroup, canReadGroup, groupRow } from "@/lib/groups";
import { listPolls } from "@/lib/polls";
import { PollCard } from "@/components/feed/PollCard";
import { Empty } from "@/components/ui/ui";

export const dynamic = "force-dynamic";

export default async function GroupPolls({ params }: { params: Promise<{ slug: string }> }) {
  const u = await requireUser();
  const g = groupRow(decodeURIComponent((await params).slug));
  if (!g || !canReadGroup(u, g)) return null;
  const polls = listPolls(u, { groupId: g.id, limit: 60 });
  return (
    <div className="narrow-col stack loose">
      {canPostInGroup(u, g) ? (
        <Link href={`/polls/new?group=${g.id}`} className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
          <Plus size={16} /> New poll in {g.name}
        </Link>
      ) : null}
      {polls.map((p) => (
        <PollCard key={p.id} poll={p} />
      ))}
      {!polls.length ? <Empty icon={<Vote size={24} />} title="No polls in this group yet" /> : null}
    </div>
  );
}
