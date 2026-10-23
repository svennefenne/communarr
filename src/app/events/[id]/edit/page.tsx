import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEvent } from "@/lib/events";
import { EventForm } from "@/components/events/EventForm";
import { BackPill } from "@/components/ui/BackPill";
import { requestT } from "@/lib/t";

export async function generateMetadata() {
  return { title: (await requestT())("Edit event") };
}

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const t = await requestT();
  const id = Number((await params).id);
  const e = getEvent(u, id);
  if (!e) notFound();
  if (!e.canEdit) redirect(`/events/${id}`);
  return (
    <div className="page mid">
      <BackPill href={`/events/${id}`} label={t("Back")} />
      <div className="page-head">
        <div>
          <span className="eyebrow">{t("Calendar")}</span>
          <h1 className="display page-title">{t("Edit the event")}</h1>
        </div>
      </div>
      <div className="panel panel-pad">
        <EventForm groups={[]} event={e} />
      </div>
    </div>
  );
}
