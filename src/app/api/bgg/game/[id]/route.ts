import { getUser } from "@/lib/auth";
import { BggError, bggGame, bggMode } from "@/lib/bgg";

export const dynamic = "force-dynamic";

/** GET /api/bgg/game/:id → { game } (a game's card); null without a token or when it isn't there */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const id = Number((await params).id);
  if (bggMode() !== "full" || !Number.isInteger(id) || id <= 0) return Response.json({ game: null });
  try {
    return Response.json({ game: await bggGame(user.id, id) });
  } catch (e) {
    if (e instanceof BggError) return Response.json({ game: null, error: e.kind });
    throw e;
  }
}
