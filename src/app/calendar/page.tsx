import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { eventsBetween, feedToken } from "@/lib/events";
import { getSettings } from "@/lib/settings";
import { baseUrl } from "@/lib/url";
import { Calendar } from "@/components/events/Calendar";
import { requestT } from "@/lib/t";

export async function generateMetadata() {
  return { title: (await requestT())("Calendar") };
}
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const u = await requireUser();
  const t = await requestT();
  if (!getSettings().features.calendar) notFound();
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const initial = eventsBetween(u, first.getTime() - 7 * 86_400_000, first.getTime() + 42 * 86_400_000);
  const base = await baseUrl();
  const tok = feedToken(u.id);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">{t("Plans")}</span>
          <h1 className="display page-title">{t("Calendar")}</h1>
        </div>
      </div>
      <Calendar initial={initial} feedUrl={{ mine: `${base}/cal/${tok}.ics`, all: `${base}/cal/${tok}.ics?all=1` }} canCreate />
    </div>
  );
}
