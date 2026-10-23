import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { postableGroups } from "@/lib/groups";
import { EventForm } from "@/components/events/EventForm";
import { BackPill } from "@/components/ui/BackPill";
import { requestT } from "@/lib/t";

export async function generateMetadata() {
  return { title: (await requestT())("Plan an event") };
}

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ date?: string; group?: string }> }) {
  const u = await requireUser();
  const t = await requestT();
  const s = getSettings();
  if (!s.features.calendar) notFound();
  if (s.canCreate.events === "mods" && !u.isMod) redirect("/calendar");
  const { date, group } = await searchParams;
  return (
    <div className="page mid">
      <BackPill href="/calendar" label={t("Calendar")} />
      <div className="page-head">
        <div>
          <span className="eyebrow">{t("Calendar")}</span>
          <h1 className="display page-title">{t("Plan something")}</h1>
        </div>
      </div>
      <div className="panel panel-pad">
        <EventForm groups={postableGroups(u)} date={date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined} groupId={group ? Number(group) : undefined} />
      </div>
    </div>
  );
}
