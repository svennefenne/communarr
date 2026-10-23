import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Vote } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listPolls } from "@/lib/polls";
import { getSettings } from "@/lib/settings";
import { PollCard } from "@/components/feed/PollCard";
import { Empty } from "@/components/ui/ui";

export const metadata = { title: "Polls" };
export const dynamic = "force-dynamic";

const TABS = [
  ["open", "Open"],
  ["todo", "Not voted yet"],
  ["closed", "Closed"],
  ["mine", "Mine"],
] as const;

export default async function PollsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const u = await requireUser();
  const s = getSettings();
  if (!s.features.polls) notFound();
  const { tab = "open" } = await searchParams;
  let polls =
    tab === "closed" ? listPolls(u, { state: "closed", limit: 40 }) : tab === "mine" ? listPolls(u, { authorId: u.id, limit: 60 }) : listPolls(u, { state: "open", limit: 60 });
  if (tab === "todo") polls = polls.filter((p) => !p.voted);
  const canCreate = s.canCreate.polls === "members" || u.isMod;
  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <span className="eyebrow">Ask everyone</span>
          <h1 className="display page-title">Polls</h1>
        </div>
        {canCreate ? (
          <div className="page-actions">
            <Link href="/polls/new" className="btn btn-primary">
              <Plus size={16} /> New poll
            </Link>
          </div>
        ) : null}
      </div>
      <nav className="tabs">
        {TABS.map(([id, label]) => (
          <Link key={id} href={`/polls?tab=${id}`} className={tab === id ? "active" : ""}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="stack loose">
        {polls.map((p) => (
          <PollCard key={p.id} poll={p} />
        ))}
        {!polls.length ? (
          <Empty icon={<Vote size={24} />} title={tab === "todo" ? "You've voted on everything" : "No polls here"}>
            {canCreate ? (
              <Link href="/polls/new" className="link">
                Ask something
              </Link>
            ) : null}
          </Empty>
        ) : null}
      </div>
    </div>
  );
}
