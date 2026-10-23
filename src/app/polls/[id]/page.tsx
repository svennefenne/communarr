import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPoll } from "@/lib/polls";
import { markReadByUrl } from "@/lib/notify";
import { PollCard } from "@/components/feed/PollCard";
import { BackPill } from "@/components/ui/BackPill";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const p = getPoll(u, Number((await params).id));
  return { title: p ? p.question : "Poll" };
}

export default async function PollPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const id = Number((await params).id);
  const p = getPoll(u, id);
  if (!p) notFound();
  markReadByUrl(u.id, `/polls/${id}`);
  return (
    <div className="page narrow">
      <BackPill href="/polls" label="Polls" />
      <PollCard poll={p} full />
    </div>
  );
}
