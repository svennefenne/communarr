import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { requestT } from "@/lib/t";
import { getSettings } from "@/lib/settings";
import { postableGroups } from "@/lib/groups";
import { PollForm } from "@/components/polls/PollForm";
import { BackPill } from "@/components/ui/BackPill";

export async function generateMetadata() {
  return { title: (await requestT())("New poll") };
}

export default async function NewPollPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const u = await requireUser();
  const s = getSettings();
  if (!s.features.polls) notFound();
  if (s.canCreate.polls === "mods" && !u.isMod) redirect("/polls");
  const { group } = await searchParams;
  const t = await requestT();
  return (
    <div className="page mid">
      <BackPill href="/polls" label={t("Polls")} />
      <div className="page-head">
        <div>
          <span className="eyebrow">{t("Polls")}</span>
          <h1 className="display page-title">{t("Ask something")}</h1>
        </div>
      </div>
      <div className="panel panel-pad">
        <PollForm groups={postableGroups(u)} groupId={group ? Number(group) : undefined} />
      </div>
    </div>
  );
}
