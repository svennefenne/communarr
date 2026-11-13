import fs from "node:fs";
import { Readable } from "node:stream";
import { appFile, githubFile } from "@/lib/apps";

export const dynamic = "force-dynamic";

const TYPES: [RegExp, string][] = [
  [/\.apk$/, "application/vnd.android.package-archive"],
  [/\.AppImage$/, "application/vnd.appimage"],
  [/\.exe$/, "application/vnd.microsoft.portable-executable"],
  [/\.zip$/, "application/zip"],
];

/**
 * GET /friends-0.1.0.apk, /friends-desktop-0.1.0-linux-x86_64.AppImage, … (the proxy sends them here):
 * one of the server's own copies of its apps, for anyone; or an app under its own name, newest on
 * GitHub (/communarr-0.2.0.apk, /communarr-desktop-0.2.0-…): on to its file.
 */
export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file: name } = await params;
  const file = appFile(name);
  if (!file) {
    const gh = githubFile(name);
    return gh ? Response.redirect(gh, 302) : new Response("Not found", { status: 404 });
  }
  const size = fs.statSync(file).size;
  return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, {
    headers: {
      "Content-Type": TYPES.find(([r]) => r.test(name))?.[1] ?? "application/octet-stream",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
