import { getUser } from "@/lib/auth";
import { BggError, bggMode, searchGames } from "@/lib/bgg";

export const dynamic = "force-dynamic";

/** GET /api/bgg/search?q=… → { mode, games } (bgg: in the editor); error: "token" | "busy" | "down" */
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const mode = bggMode();
  if (mode !== "full") return Response.json({ mode, games: [] });
  try {
    return Response.json({ mode, games: await searchGames(user.id, new URL(req.url).searchParams.get("q") ?? "") });
  } catch (e) {
    if (e instanceof BggError) return Response.json({ mode, games: [], error: e.kind });
    throw e;
  }
}
