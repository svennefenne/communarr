import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEvent } from "@/lib/events";
import { markReadByUrl } from "@/lib/notify";
import { EventDetail } from "@/components/events/EventDetail";
import { BackPill } from "@/components/ui/BackPill";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const e = getEvent(u, Number((await params).id));
  return { title: e ? e.title : "Event" };
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const id = Number((await params).id);
  const e = getEvent(u, id);
  if (!e) notFound();
  markReadByUrl(u.id, `/events/${id}`);
  return (
    <div className="page">
      <BackPill href="/calendar" label="Calendar" />
      <EventDetail event={e} />
    </div>
  );
}
