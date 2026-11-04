import { currentSessionId, getUser } from "@/lib/auth";
import { appPushOptions, saveAppToken } from "@/lib/fcm";

export const dynamic = "force-dynamic";

/** GET /api/app/push?app=<package>: the Android app's Firebase settings ({options: null} when the admin hasn't set it up). */
export async function GET(req: Request) {
  if (!(await getUser())) return Response.json({ ok: false }, { status: 401 });
  const pkg = new URL(req.url).searchParams.get("app") ?? "";
  return Response.json({ ok: true, options: appPushOptions(pkg) });
}

/**
 * POST /api/app/push {token, app}: this phone's token, for as long as this log-in lasts (JSON only).
 * POST /api/app/push {error, app}: why this phone couldn't sign up with Firebase, for the server's log.
 */
export async function POST(req: Request) {
  const user = await getUser();
  const session = await currentSessionId();
  if (!user || !session) return Response.json({ ok: false }, { status: 401 });
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return Response.json({ ok: false }, { status: 415 });
  const b = (await req.json().catch(() => null)) as { token?: unknown; app?: unknown; error?: unknown } | null;
  if (typeof b?.error === "string") {
    console.warn(`[app notifications] ${user.username} (${String(b.app ?? "").slice(0, 100)}) couldn't sign up: ${b.error.slice(0, 500)}`);
    return Response.json({ ok: true });
  }
  if (typeof b?.token !== "string" || !b.token.trim()) return Response.json({ ok: false }, { status: 400 });
  saveAppToken(user.id, session, b.token.trim(), String(b.app ?? ""));
  return Response.json({ ok: true });
}
