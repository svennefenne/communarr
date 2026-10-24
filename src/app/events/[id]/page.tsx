import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEvent } from "@/lib/events";
import { markReadByUrl } from "@/lib/notify";
import { EventDetail } from "@/components/events/EventDetail";
import { BackPill } from "@/components/ui/BackPill";
import { requestT } from "@/lib/t";
import { cachedPreview, previewKey, type LinkPreview } from "@/lib/links";
import { linksIn } from "@/lib/linksIn";
import { baseUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const e = getEvent(u, Number((await params).id));
  return { title: e ? e.title : (await requestT())("Event") };
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const t = await requestT();
  const id = Number((await params).id);
  const e = getEvent(u, id);
  if (!e) notFound();
  markReadByUrl(u.id, `/events/${id}`);
  // the previews of its links the site already has (the rest are fetched in the browser)
  const base = await baseUrl();
  const previews: Record<string, LinkPreview | null> = {};
  for (const url of linksIn(e.html)) {
    const kept = cachedPreview(previewKey(url, base) ?? "");
    if (kept !== undefined) previews[url] = kept;
  }
  return (
    <div className="page">
      <BackPill href="/calendar" label={t("Calendar")} />
      <EventDetail event={e} previews={previews} />
    </div>
  );
}
