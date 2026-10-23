import { getUser } from "@/lib/auth";
import { canSeeEvent, eventRow, icsFor } from "@/lib/events";

/** GET /events/<id>/ics: one event as a file for a calendar app. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getUser();
  if (!u) return new Response("Log in first", { status: 401 });
  const e = eventRow(Number((await params).id));
  if (!e || !canSeeEvent(u, e)) return new Response("Not found", { status: 404 });
  const name = e.title.replace(/[^\w\- ]+/g, "").trim().slice(0, 60) || "event";
  return new Response(icsFor([e], e.title, process.env.PUBLIC_URL || ""), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.ics"` },
  });
}
