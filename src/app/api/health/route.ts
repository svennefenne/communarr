import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/health: for Docker's health check (and uptime monitors). */
export async function GET() {
  try {
    db().prepare("select 1").get();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
