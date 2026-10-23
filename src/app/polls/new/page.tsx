import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { postableGroups } from "@/lib/groups";
import { PollForm } from "@/components/polls/PollForm";
import { BackPill } from "@/components/ui/BackPill";

export const metadata = { title: "New poll" };

export default async function NewPollPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const u = await requireUser();
  const s = getSettings();
  if (!s.features.polls) notFound();
  if (s.canCreate.polls === "mods" && !u.isMod) redirect("/polls");
  const { group } = await searchParams;
  return (
    <div className="page mid">
      <BackPill href="/polls" label="Polls" />
      <div className="page-head">
        <div>
          <span className="eyebrow">Polls</span>
          <h1 className="display page-title">Ask something</h1>
        </div>
      </div>
      <div className="panel panel-pad">
        <PollForm groups={postableGroups(u)} groupId={group ? Number(group) : undefined} />
      </div>
    </div>
  );
}
