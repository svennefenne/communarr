import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Vote } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { requestT } from "@/lib/t";
import { listPolls } from "@/lib/polls";
import { getSettings } from "@/lib/settings";
import { PollCard } from "@/components/feed/PollCard";
import { Empty } from "@/components/ui/ui";

export async function generateMetadata() {
  return { title: (await requestT())("Polls") };
}
export const dynamic = "force-dynamic";

// "Open" and "Closed" here are the polls (plural), so they're kept apart from the single words
// elsewhere with an empty {polls} (the dictionary has "Open{polls}")
const TABS = [
  ["open", "Open{polls}"],
  ["todo", "Not voted yet"],
  ["closed", "Closed{polls}"],
  ["mine", "Mine"],
] as const;

export default async function PollsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const u = await requireUser();
  const t = await requestT();
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
          <span className="eyebrow">{t("Ask everyone")}</span>
          <h1 className="display page-title">{t("Polls")}</h1>
        </div>
        {canCreate ? (
          <div className="page-actions">
            <Link href="/polls/new" className="btn btn-primary">
              <Plus size={16} /> {t("New poll")}
            </Link>
          </div>
        ) : null}
      </div>
      <nav className="tabs">
        {TABS.map(([id, label]) => (
          <Link key={id} href={`/polls?tab=${id}`} className={tab === id ? "active" : ""}>
            {t(label, { polls: "" })}
          </Link>
        ))}
      </nav>
      <div className="stack loose">
        {polls.map((p) => (
          <PollCard key={p.id} poll={p} />
        ))}
        {!polls.length ? (
          <Empty icon={<Vote size={24} />} title={t(tab === "todo" ? "You've voted on everything" : "No polls here")}>
            {canCreate ? (
              <Link href="/polls/new" className="link">
                {t("Ask something")}
              </Link>
            ) : null}
          </Empty>
        ) : null}
      </div>
    </div>
  );
}
