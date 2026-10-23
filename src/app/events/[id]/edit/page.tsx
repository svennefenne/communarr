import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEvent } from "@/lib/events";
import { EventForm } from "@/components/events/EventForm";
import { BackPill } from "@/components/ui/BackPill";

export const metadata = { title: "Edit event" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const id = Number((await params).id);
  const e = getEvent(u, id);
  if (!e) notFound();
  if (!e.canEdit) redirect(`/events/${id}`);
  return (
    <div className="page mid">
      <BackPill href={`/events/${id}`} />
      <div className="page-head">
        <div>
          <span className="eyebrow">Calendar</span>
          <h1 className="display page-title">Edit the event</h1>
        </div>
      </div>
      <div className="panel panel-pad">
        <EventForm groups={[]} event={e} />
      </div>
    </div>
  );
}
