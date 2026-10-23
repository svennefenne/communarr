import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { requestT } from "@/lib/t";
import { getPoll } from "@/lib/polls";
import { PollForm } from "@/components/polls/PollForm";
import { BackPill } from "@/components/ui/BackPill";

export async function generateMetadata() {
  return { title: (await requestT())("Edit poll") };
}

export default async function EditPollPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const id = Number((await params).id);
  const p = getPoll(u, id);
  if (!p) notFound();
  if (!p.canEdit) redirect(`/polls/${id}`);
  const t = await requestT();
  return (
    <div className="page mid">
      <BackPill href={`/polls/${id}`} />
      <div className="page-head">
        <div>
          <span className="eyebrow">{t("Polls")}</span>
          <h1 className="display page-title">{t("Edit the poll")}</h1>
        </div>
      </div>
      <div className="panel panel-pad">
        <PollForm groups={[]} poll={p} />
      </div>
    </div>
  );
}
