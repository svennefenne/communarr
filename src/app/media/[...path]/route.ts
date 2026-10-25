import fs from "node:fs";
import { getUser } from "@/lib/auth";
import { mediaFile } from "@/lib/uploads";
import { requestT } from "@/lib/t";

const TYPES: Record<string, string> = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  // sounds (Admin → Sounds)
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  webm: "audio/webm",
  flac: "audio/flac",
};

// what the log-in page shows, so anyone may see it: backgrounds and the logo
const PUBLIC = new Set(["bg", "logo"]);

/** GET /media/…: an uploaded picture (members only, except backgrounds and the logo). */
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  if (!PUBLIC.has(parts[0]) && !(await getUser())) return new Response((await requestT())("Log in first."), { status: 401 });
  const file = mediaFile(parts);
  if (!file) return new Response((await requestT())("Not found"), { status: 404 });
  const ext = file.split(".").pop()!.toLowerCase();
  const stat = fs.statSync(file);
  const body = fs.readFileSync(file);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Content-Length": String(stat.size),
      // file names never change: keep them for good
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
