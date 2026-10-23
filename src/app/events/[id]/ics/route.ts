import { getUser } from "@/lib/auth";
import { canSeeEvent, eventRow, icsFor } from "@/lib/events";
import { requestT, userT } from "@/lib/t";

/** GET /events/<id>/ics: one event as a file for a calendar app. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getUser();
  if (!u) return new Response((await requestT())("Log in first"), { status: 401 });
  const t = userT(u.id);
  const e = eventRow(Number((await params).id));
  if (!e || !canSeeEvent(u, e)) return new Response(t("Not found"), { status: 404 });
  const name = e.title.replace(/[^\w\- ]+/g, "").trim().slice(0, 60) || "event";
  return new Response(icsFor([e], e.title, process.env.PUBLIC_URL || "", t), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.ics"` },
  });
}
