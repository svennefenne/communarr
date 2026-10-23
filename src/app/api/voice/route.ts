import { getUser } from "@/lib/auth";
import { connById } from "@/lib/hub";
import { canSee, room } from "@/lib/chat";
import { getSettings } from "@/lib/settings";
import { iceServers, joinVoice, leaveVoice, muteVoice, relayVoice, voiceSnapshot } from "@/lib/voice";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => Response.json({ error }, { status });

/** GET /api/voice → { channels, ice }: who's talking where, and the servers for the calls. */
export async function GET() {
  if (!(await getUser())) return fail("Log in first.", 401);
  return Response.json({ channels: voiceSnapshot(), ice: iceServers() });
}

/**
 * POST /api/voice { action, room, conn, … }
 *   join                  → { others, ice }: the tabs to call
 *   leave
 *   mute { muted }
 *   signal { to, data }   a call's set-up message for another tab in the channel
 */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return fail("Log in first.", 401);
  if (!getSettings().features.voice) return fail("Voice chat is switched off.", 403);
  const b = (await req.json().catch(() => ({}))) as { action?: string; room?: number; conn?: number; muted?: boolean; to?: number; data?: unknown };
  const conn = connById(Number(b.conn), user.id);
  if (!conn) return fail("Not connected: reload the page.", 409);
  const roomId = Number(b.room);
  switch (b.action) {
    case "join": {
      const r = room(roomId);
      if (!r || !canSee(user, r)) return fail("You can't join this room's voice.", 403);
      const others = joinVoice(user.id, roomId, conn.id);
      if (others === "full") return fail(`The voice channel is full (${getSettings().voice.max} at most).`, 409);
      return Response.json({ others, ice: iceServers() });
    }
    case "leave":
      leaveVoice(roomId, conn.id);
      return Response.json({ ok: true });
    case "mute":
      muteVoice(roomId, conn.id, !!b.muted);
      return Response.json({ ok: true });
    case "signal":
      return relayVoice(roomId, conn.id, Number(b.to), b.data) ? Response.json({ ok: true }) : fail("Not in the voice channel.", 404);
    default:
      return fail("Unknown action.");
  }
}
