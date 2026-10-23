import { getUser } from "@/lib/auth";
import { pushTo, removeSubscription, saveSubscription, vapidPublicKey } from "@/lib/push";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** GET /api/push → { key }: the key a browser subscribes with. */
export async function GET() {
  if (!(await getUser())) return Response.json({ error: "Log in first." }, { status: 401 });
  return Response.json({ key: vapidPublicKey() });
}

/**
 * POST /api/push { subscription }          this device wants notifications
 * POST /api/push { test: true }            send a test notification to every device
 */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }; test?: boolean };
  if (b.test) {
    const r = await pushTo(user.id, { title: `${getSettings().siteName} says hi 👋`, body: "Notifications work on this device.", url: "/settings/notifications", tag: "test" });
    return Response.json(r);
  }
  const s = b.subscription;
  if (!s?.endpoint || !s.keys?.p256dh || !s.keys.auth || !/^https:\/\//.test(s.endpoint)) return Response.json({ error: "That isn't a subscription." }, { status: 400 });
  saveSubscription(user.id, { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }, req.headers.get("user-agent") || "");
  return Response.json({ ok: true });
}

/** DELETE /api/push { endpoint }: this device doesn't want notifications any more. */
export async function DELETE(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (b.endpoint) removeSubscription(user.id, b.endpoint);
  return Response.json({ ok: true });
}
