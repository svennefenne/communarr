import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { db, now, UPLOAD_DIR } from "./db";
import { UserError } from "./errors";

/**
 * Pictures people upload. Every one is re-encoded (WebP; animated GIFs stay animated), turned the
 * right way up and stripped of its metadata (no GPS positions from phones), and sized for what it's
 * for. Files live under DATA_DIR/uploads and are served by /media/….
 */

export type UploadKind = "image" | "avatar" | "banner" | "cover" | "background" | "preview" | "logo";

const DIRS: Record<UploadKind, string> = { image: "img", avatar: "avatar", banner: "banner", cover: "cover", background: "bg", preview: "preview", logo: "logo" };

export interface Uploaded {
  id: string;
  url: string;
  thumb: string | null;
  width: number;
  height: number;
  size: number;
}

const ALLOWED = new Set(["jpeg", "png", "webp", "gif", "avif", "heif", "tiff"]);

export async function saveUpload(userId: number, buf: Buffer, kind: UploadKind, name: string): Promise<Uploaded> {
  const meta = await sharp(buf, { animated: true, limitInputPixels: 120_000_000 }).metadata();
  if (!meta.format || !ALLOWED.has(meta.format)) throw new UserError("That isn't a picture we can use (JPEG, PNG, WebP, GIF or AVIF).");
  const animated = (meta.pages ?? 1) > 1 && (kind === "image" || kind === "avatar");
  const id = crypto.randomBytes(12).toString("base64url");
  const d = new Date();
  const rel = path.join(/*turbopackIgnore: true*/ DIRS[kind], String(d.getUTCFullYear()), String(d.getUTCMonth() + 1).padStart(2, "0"));
  fs.mkdirSync(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, rel), { recursive: true });

  let img = sharp(buf, { animated, limitInputPixels: 120_000_000 }).rotate();
  switch (kind) {
    case "avatar":
      img = img.resize(512, 512, { fit: "cover", position: "attention" });
      break;
    case "banner":
      img = img.resize(1800, 600, { fit: "cover", position: "attention", withoutEnlargement: false });
      break;
    case "cover":
      img = img.resize(1600, 900, { fit: "inside", withoutEnlargement: true });
      break;
    case "background":
      img = img.resize(2560, 2560, { fit: "inside", withoutEnlargement: true });
      break;
    case "preview":
      img = img.resize(1200, 1200, { fit: "inside", withoutEnlargement: true });
      break;
    case "logo":
      // (transparency kept; the app icons are cut from it at their own sizes)
      img = img.resize(512, 512, { fit: "inside", withoutEnlargement: true });
      break;
    default:
      img = img.resize(2048, 2048, { fit: "inside", withoutEnlargement: true });
  }
  const out = await img.webp({ quality: kind === "background" ? 85 : 82, effort: 4, loop: 0 }).toBuffer({ resolveWithObject: true });
  const file = path.join(rel, `${id}.webp`);
  fs.writeFileSync(path.join(UPLOAD_DIR, file), out.data);
  const height = animated && out.info.pageHeight ? out.info.pageHeight : out.info.height;

  let thumb: string | null = null;
  if (kind === "image" && (out.info.width > 720 || height > 720)) {
    const t = await sharp(out.data, { animated }).resize(720, 720, { fit: "inside" }).webp({ quality: 78, loop: 0 }).toBuffer();
    thumb = path.join(rel, `${id}.t.webp`);
    fs.writeFileSync(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, thumb), t);
  }
  db()
    .prepare("insert into uploads (id, user_id, kind, path, thumb, mime, size, width, height, name, created_at) values (?, ?, ?, ?, ?, 'image/webp', ?, ?, ?, ?, ?)")
    .run(id, userId, kind, file, thumb, out.data.length, out.info.width, height, name.slice(0, 120), now());
  return { id, url: `/media/${file.split(path.sep).join("/")}`, thumb: thumb ? `/media/${thumb.split(path.sep).join("/")}` : null, width: out.info.width, height, size: out.data.length };
}

/** A sound's kind from its first bytes (what it says it is doesn't count): its file ending and type. */
function soundType(buf: Buffer): { ext: string; mime: string } | null {
  const at = (i: number, s: string) => buf.subarray(i, i + s.length).toString("latin1") === s;
  if (at(0, "ID3") || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return { ext: "mp3", mime: "audio/mpeg" };
  if (at(0, "OggS")) return { ext: "ogg", mime: "audio/ogg" };
  if (at(0, "RIFF") && at(8, "WAVE")) return { ext: "wav", mime: "audio/wav" };
  if (at(0, "fLaC")) return { ext: "flac", mime: "audio/flac" };
  if (at(4, "ftyp")) return { ext: "m4a", mime: "audio/mp4" };
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { ext: "webm", mime: "audio/webm" };
  return null;
}

export const SOUND_MAX_BYTES = 2 * 1024 * 1024;

/**
 * A sound an admin uploads (Admin → Sounds): MP3, OGG, WAV, FLAC, M4A or WebM, at most 2 MB, kept
 * as it is (the browser plays it; nothing on the server decodes it).
 */
export function saveSound(userId: number, buf: Buffer, name: string): Uploaded {
  if (buf.length > SOUND_MAX_BYTES) throw new UserError("That sound is too big ({n} MB at most).", { n: 2 });
  const type = soundType(buf);
  if (!type) throw new UserError("That isn't a sound file we can play (MP3, OGG, WAV, FLAC, M4A or WebM).");
  const id = crypto.randomBytes(12).toString("base64url");
  const d = new Date();
  const rel = path.join("sound", String(d.getUTCFullYear()), String(d.getUTCMonth() + 1).padStart(2, "0"));
  fs.mkdirSync(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, rel), { recursive: true });
  const file = path.join(rel, `${id}.${type.ext}`);
  fs.writeFileSync(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, file), buf);
  db()
    .prepare("insert into uploads (id, user_id, kind, path, thumb, mime, size, width, height, name, created_at) values (?, ?, 'sound', ?, null, ?, ?, 0, 0, ?, ?)")
    .run(id, userId, file, type.mime, buf.length, name.slice(0, 120), now());
  return { id, url: `/media/${file.split(path.sep).join("/")}`, thumb: null, width: 0, height: 0, size: buf.length };
}

/** The file behind a /media/… path, or null (nothing outside the uploads folder). */
export function mediaFile(parts: string[]): string | null {
  const rel = parts.join("/");
  if (!/^[\w./-]+$/.test(rel) || rel.includes("..")) return null;
  const full = path.resolve(UPLOAD_DIR, rel);
  if (!full.startsWith(UPLOAD_DIR + path.sep)) return null;
  return fs.existsSync(full) ? full : null;
}

export function uploadStats() {
  const r = db().prepare("select count(*) n, coalesce(sum(size), 0) bytes from uploads").get() as { n: number; bytes: number };
  const byKind = db().prepare("select kind, count(*) n, coalesce(sum(size), 0) bytes from uploads group by kind").all() as { kind: string; n: number; bytes: number }[];
  return { ...r, byKind };
}

/** Delete uploads nothing points at any more (older than a day, so a post being written keeps its pictures). */
export function cleanOrphans(): { removed: number; bytes: number } {
  // link previews are fetched again when they're wanted after a month; their pictures go with them
  db().prepare("delete from link_previews where fetched_at < ?").run(now() - 30 * 86_400_000);
  const rows = db().prepare("select id, path, thumb, size from uploads where created_at < ?").all(now() - 86_400_000) as { id: string; path: string; thumb: string | null; size: number }[];
  const used = new Set<string>();
  const sources = [
    "select body_html h from posts",
    "select cover h from posts where cover is not null",
    "select body_html h from comments",
    "select body_html h from forum_threads",
    "select body_html h from forum_posts",
    "select description_html h from polls",
    "select description_html h from events",
    "select cover h from events where cover is not null",
    "select body_html h from messages",
    "select bio_html h from users",
    "select avatar h from users where avatar is not null",
    "select banner h from users where banner is not null",
    "select description_html h from groups",
    "select avatar h from groups where avatar is not null",
    "select banner h from groups where banner is not null",
    "select data_json h from themes",
    "select value h from settings",
    "select image h from link_previews where image is not null",
  ];
  // (the sounds in Admin → Sounds are in the settings: kept like a picture in a post)
  for (const sql of sources) for (const r of db().prepare(sql).all() as { h: string }[]) for (const m of (r.h || "").matchAll(/\/media\/[\w/-]+\/([\w-]+)(\.t)?\.(?:webp|mp3|ogg|oga|wav|m4a|webm|flac)/g)) used.add(m[1]);
  let removed = 0;
  let bytes = 0;
  for (const r of rows) {
    if (used.has(r.id)) continue;
    for (const p of [r.path, r.thumb]) if (p) fs.rmSync(path.join(UPLOAD_DIR, p), { force: true });
    db().prepare("delete from uploads where id = ?").run(r.id);
    removed++;
    bytes += r.size;
  }
  return { removed, bytes };
}
