import { logIn } from "@/lib/login";

export const dynamic = "force-dynamic";

/**
 * POST /api/app/login {username, password}: the Android app's own log-in screen. The same checks and
 * session cookie as the site's log-in page; {ok: true} when it worked, else {ok: false, error} saying
 * why (in the site's language, as on its log-in page). JSON only: a page elsewhere can't send that
 * without asking first (CORS), so it can't log a visitor in as someone else.
 */
export async function POST(req: Request) {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return Response.json({ ok: false }, { status: 415 });
  const body = (await req.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
  if (!body) return Response.json({ ok: false }, { status: 400 });
  const r = await logIn(String(body.username ?? "").trim(), String(body.password ?? ""));
  // (a note, such as "we've sent a new confirmation link", isn't a log-in either)
  return Response.json(r ? { ok: false, error: r.error ?? r.ok } : { ok: true });
}
