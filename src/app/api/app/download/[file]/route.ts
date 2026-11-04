import fs from "node:fs";
import { appFile } from "@/lib/apps";

export const dynamic = "force-dynamic";

/** GET /communarr-0.1.0.apk (the proxy sends it here): one of the server's own copies of the Android app, for anyone. */
export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file: name } = await params;
  const file = appFile(name);
  if (!file) return new Response("Not found", { status: 404 });
  const body = fs.readFileSync(file);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Length": String(body.length),
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
