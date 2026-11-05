import { getUser } from "@/lib/auth";
import { categoryLinks } from "@/lib/forum";
import { linkHits, linkTarget } from "@/lib/search";

export const dynamic = "force-dynamic";

/**
 * The editor's Link. GET /api/search/link?q=… → { hits, categories }: what to link to (the latest
 * things, before anything is typed) and the forum's categories. ?url=/forum/t/12 → { target }: what a
 * link points at, { kind, title } (or null).
 */
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ hits: [], categories: [] }, { status: 401 });
  const url = new URL(req.url);
  const to = url.searchParams.get("url");
  if (to !== null) return Response.json({ target: linkTarget(user.id, to.slice(0, 500)) });
  const q = (url.searchParams.get("q") || "").slice(0, 200);
  return Response.json({ hits: linkHits(user.id, q), categories: categoryLinks(user) });
}
