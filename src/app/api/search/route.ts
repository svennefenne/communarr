import { getUser } from "@/lib/auth";
import { search, KIND_LABEL, type SearchKind } from "@/lib/search";

export const dynamic = "force-dynamic";

/** GET /api/search?q=…&kind=…&offset=… → { hits, counts } */
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ hits: [], counts: {} }, { status: 401 });
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").slice(0, 200);
  const kind = url.searchParams.get("kind") as SearchKind | null;
  const res = search(user.id, q, {
    kinds: kind && kind in KIND_LABEL ? [kind] : undefined,
    limit: Math.min(50, Number(url.searchParams.get("limit")) || 20),
    offset: Number(url.searchParams.get("offset")) || 0,
  });
  return Response.json(res);
}
