import { getUser } from "@/lib/auth";
import { cachedPreview, linkPreview, previewKey } from "@/lib/links";
import { baseUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

// links fetched (not kept ones) per member: a few dozen in ten minutes is plenty for writing
const g = globalThis as typeof globalThis & { __hdPreviewRate?: Map<number, number[]> };
const recent = (g.__hdPreviewRate ??= new Map());
const WINDOW = 10 * 60_000;
const MAX = 40;

/** GET /api/link-preview?url=… → { preview } (null: the link has none) */
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const key = previewKey(new URL(req.url).searchParams.get("url") ?? "", await baseUrl());
  if (!key) return Response.json({ preview: null });
  const kept = cachedPreview(key);
  if (kept !== undefined) return Response.json({ preview: kept });
  const t = Date.now();
  const mine = (recent.get(user.id) ?? []).filter((x: number) => x > t - WINDOW);
  if (mine.length >= MAX) return Response.json({ preview: null, later: true }, { status: 429 });
  recent.set(user.id, [...mine, t]);
  return Response.json({ preview: await linkPreview(user.id, key) });
}
