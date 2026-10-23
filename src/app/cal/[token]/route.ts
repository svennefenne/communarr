import { feedEvents, icsFor, userForFeed } from "@/lib/events";
import { getSettings } from "@/lib/settings";
import { userById } from "@/lib/users";

export const dynamic = "force-dynamic";

/** GET /cal/<token>.ics (?all=1): a member's calendar feed for phone and computer calendar apps. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const id = userForFeed(token.replace(/\.ics$/, ""));
  const u = id ? userById(id) : null;
  if (!u || u.banned) return new Response("Not found", { status: 404 });
  const all = new URL(req.url).searchParams.get("all") === "1";
  const s = getSettings();
  const body = icsFor(feedEvents(u.id, all), `${s.siteName}${all ? "" : " · mine"}`, process.env.PUBLIC_URL || "");
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300" } });
}
