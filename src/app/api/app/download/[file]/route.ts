import fs from "node:fs";
import { appFile, GENERIC, githubApp } from "@/lib/apps";

export const dynamic = "force-dynamic";

/**
 * GET /friends-0.1.0.apk (the proxy sends it here): one of the server's own copies of the Android app,
 * for anyone; or the app under its own name, newest on GitHub (/communarr-0.2.0.apk): on to its file.
 */
export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file: name } = await params;
  const file = appFile(name);
  const gh = githubApp();
  if (!file && gh && name === `${GENERIC}-${gh.version}.apk`) return Response.redirect(gh.url, 302);
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
