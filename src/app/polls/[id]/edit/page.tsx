import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPoll } from "@/lib/polls";
import { PollForm } from "@/components/polls/PollForm";
import { BackPill } from "@/components/ui/BackPill";

export const metadata = { title: "Edit poll" };

export default async function EditPollPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const id = Number((await params).id);
  const p = getPoll(u, id);
  if (!p) notFound();
  if (!p.canEdit) redirect(`/polls/${id}`);
  return (
    <div className="page mid">
      <BackPill href={`/polls/${id}`} />
      <div className="page-head">
        <div>
          <span className="eyebrow">Polls</span>
          <h1 className="display page-title">Edit the poll</h1>
        </div>
      </div>
      <div className="panel panel-pad">
        <PollForm groups={[]} poll={p} />
      </div>
    </div>
  );
}
