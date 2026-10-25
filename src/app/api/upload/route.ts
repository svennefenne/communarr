import { getUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { saveSound, saveUpload, type UploadKind } from "@/lib/uploads";
import { UserError } from "@/lib/errors";
import { requestT } from "@/lib/t";
import { importImage } from "@/lib/links";
import { baseUrl } from "@/lib/url";
import { canAddEmoji } from "@/lib/emojis";

export const dynamic = "force-dynamic";

const KINDS: UploadKind[] = ["image", "avatar", "banner", "cover", "background", "logo", "emoji"];

// a few uploads at once per member, so a phone dropping 30 photos doesn't swamp the NUC
const g = globalThis as typeof globalThis & { __hdUploads?: Map<number, number> };
const busy = (g.__hdUploads ??= new Map());

/** POST /api/upload (multipart: file or url, kind) → { url, thumb, width, height } (or { notImage } for a page link with only=1) */
export async function POST(req: Request) {
  const user = await getUser();
  const t = await requestT();
  if (!user) return Response.json({ error: t("Log in first.") }, { status: 401 });
  if ((busy.get(user.id) ?? 0) >= 4) return Response.json({ error: t("Hold on, still working on your last pictures.") }, { status: 429 });
  busy.set(user.id, (busy.get(user.id) ?? 0) + 1);
  try {
    const fd = await req.formData().catch(() => null);
    const file = fd?.get("file");
    const link = fd?.get("url");
    const kind = (KINDS.includes(String(fd?.get("kind")) as UploadKind) ? String(fd?.get("kind")) : "image") as UploadKind;
    if (kind === "background" && !user.isAdmin && !getSettings().allowCustomThemes) return Response.json({ error: t("Custom backgrounds are switched off.") }, { status: 403 });
    // the site's logo (Admin → Name & texts)
    if (kind === "logo" && !user.isAdmin) return Response.json({ error: t("Only admins can do that.") }, { status: 403 });
    if (kind === "emoji" && !canAddEmoji(user)) return Response.json({ error: t("Only moderators can add emoji.") }, { status: 403 });
    // a picture's link instead of a file: fetched and kept like an upload ("only": a page stays a link)
    if (typeof link === "string" && link.trim()) {
      const out = await importImage(user.id, link, kind, { origin: await baseUrl(), onlyImage: fd?.get("only") === "1" });
      return Response.json(out ?? { notImage: true });
    }
    if (!(file instanceof File)) return Response.json({ error: t("No file.") }, { status: 400 });
    const max = getSettings().maxUploadMb * 1024 * 1024;
    if (file.size > max) return Response.json({ error: t("That picture is too big ({n} MB at most).", { n: getSettings().maxUploadMb }) }, { status: 413 });
    // a sound for Admin → Sounds: admins only, kept as it is
    if (String(fd?.get("kind")) === "sound") {
      if (!user.isAdmin) return Response.json({ error: t("Only admins can do that.") }, { status: 403 });
      return Response.json(saveSound(user.id, Buffer.from(await file.arrayBuffer()), file.name));
    }
    const out = await saveUpload(user.id, Buffer.from(await file.arrayBuffer()), kind, file.name);
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: e instanceof UserError ? e.translated(t) : t("That picture couldn't be read.") }, { status: 400 });
  } finally {
    busy.set(user.id, Math.max(0, (busy.get(user.id) ?? 1) - 1));
  }
}
