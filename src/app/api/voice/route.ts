import { getUser } from "@/lib/auth";
import { connById } from "@/lib/hub";
import { canSee, room } from "@/lib/chat";
import { getSettings } from "@/lib/settings";
import { requestT } from "@/lib/t";
import type { Vars } from "@/lib/i18n";
import { iceServers, joinVoice, leaveVoice, muteVoice, relayVoice, voiceSnapshot } from "@/lib/voice";

export const dynamic = "force-dynamic";

/** an error for the person (English text, sent in their language) */
const fail = async (error: string, status = 400, vars?: Vars) => Response.json({ error: (await requestT())(error, vars) }, { status });

/** GET /api/voice → { channels, ice }: who's talking where, and the servers for the calls. */
export async function GET() {
  const user = await getUser();
  if (!user) return fail("Log in first.", 401);
  // only the channels of rooms you can see (who's in a call in a DM is nobody else's business)
  const all = voiceSnapshot();
  const channels = Object.fromEntries(
    Object.entries(all).filter(([id]) => {
      const r = room(Number(id));
      return !!r && canSee(user, r);
    }),
  );
  return Response.json({ channels, ice: iceServers() });
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
      if (others === "full") return fail("The voice channel is full ({n} at most).", 409, { n: getSettings().voice.max });
      return Response.json({ others, ice: iceServers() });
    }
    case "leave":
      leaveVoice(roomId, conn.id);
      return Response.json({ ok: true });
    case "mute":
      muteVoice(roomId, conn.id, !!b.muted);
      return Response.json({ ok: true });
    case "signal": {
      // still allowed in the room (not removed since joining)
      const r = room(roomId);
      if (!r || !canSee(user, r)) {
        leaveVoice(roomId, conn.id);
        return fail("You can't be in this room's voice.", 403);
      }
      return relayVoice(roomId, conn.id, Number(b.to), b.data) ? Response.json({ ok: true }) : fail("Not in the voice channel.", 404);
    }
    default:
      return fail("Unknown action.");
  }
}
