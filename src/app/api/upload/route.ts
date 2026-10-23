import { getUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { saveUpload, type UploadKind } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const KINDS: UploadKind[] = ["image", "avatar", "banner", "cover", "background"];

// a few uploads at once per member, so a phone dropping 30 photos doesn't swamp the NUC
const g = globalThis as typeof globalThis & { __hdUploads?: Map<number, number> };
const busy = (g.__hdUploads ??= new Map());

/** POST /api/upload (multipart: file, kind) → { url, thumb, width, height } */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if ((busy.get(user.id) ?? 0) >= 4) return Response.json({ error: "Hold on, still working on your last pictures." }, { status: 429 });
  busy.set(user.id, (busy.get(user.id) ?? 0) + 1);
  try {
    const fd = await req.formData().catch(() => null);
    const file = fd?.get("file");
    if (!(file instanceof File)) return Response.json({ error: "No file." }, { status: 400 });
    const max = getSettings().maxUploadMb * 1024 * 1024;
    if (file.size > max) return Response.json({ error: `That picture is too big (${getSettings().maxUploadMb} MB at most).` }, { status: 413 });
    const kind = (KINDS.includes(String(fd?.get("kind")) as UploadKind) ? String(fd?.get("kind")) : "image") as UploadKind;
    if (kind === "background" && !user.isAdmin && !getSettings().allowCustomThemes) return Response.json({ error: "Custom backgrounds are switched off." }, { status: 403 });
    const out = await saveUpload(user.id, Buffer.from(await file.arrayBuffer()), kind, file.name);
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: e instanceof Error && e.message.startsWith("That") ? e.message : "That picture couldn't be read." }, { status: 400 });
  } finally {
    busy.set(user.id, Math.max(0, (busy.get(user.id) ?? 1) - 1));
  }
}
