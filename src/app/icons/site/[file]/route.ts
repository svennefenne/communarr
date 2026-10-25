import { siteIcon } from "@/lib/siteIcons";

export const dynamic = "force-dynamic";

/** GET /icons/site/<192.png | 512.png | maskable-512.png | apple-180.png>: the site's icon, its logo or the stripes. */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const png = await siteIcon((await params).file);
  if (!png) return new Response("Not here", { status: 404 });
  // (the address carries the logo's version, so it can be kept a long time)
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=604800" } });
}
