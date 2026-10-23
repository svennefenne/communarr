import { getUser } from "@/lib/auth";
import { addConn, connById, presenceList, removeConn, setVisibility } from "@/lib/hub";
import { boot } from "@/lib/boot";
import { leaveVoiceConn } from "@/lib/voice";

export const dynamic = "force-dynamic";

/**
 * GET /api/live: the signed-in member's Server-Sent Events stream. Every message is
 * `data: {"t": type, "d": data}`; the first is "hello" (this connection's number, who's online,
 * fresh unread counts).
 */
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Log in first", { status: 401 });
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      const write = (chunk: string) => {
        if (!open) return;
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const conn = addConn(user.id, (t, d) => write(`data: ${JSON.stringify({ t, d })}\n\n`));
      const ping = setInterval(() => write(`: ping\n\n`), 20_000);
      cleanup = () => {
        if (!open) return;
        open = false;
        clearInterval(ping);
        removeConn(conn);
        leaveVoiceConn(conn.id);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", cleanup);
      write(`retry: 3000\n\n`);
      write(`data: ${JSON.stringify({ t: "hello", d: { conn: conn.id, presence: presenceList(), counts: boot(user).counts } })}\n\n`);
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/** POST /api/live { conn, visible, idle, room }: the tab went out of sight, came back, or opened a chat room. */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Log in first", { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { conn?: number; visible?: boolean; idle?: boolean; room?: number | null };
  const conn = b.conn ? connById(Number(b.conn), user.id) : null;
  if (conn) {
    conn.room = typeof b.room === "number" ? b.room : null;
    setVisibility(conn, b.visible !== false, !!b.idle);
  }
  return Response.json({ ok: true });
}
