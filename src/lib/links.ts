import "server-only";
import fs from "node:fs";
import { Parser } from "htmlparser2";
import { db, now } from "./db";
import { UserError } from "./errors";
import { fetchPublic, type Fetched } from "./fetchUrl";
import { getSettings } from "./settings";
import { mediaFile, saveUpload, type Uploaded, type UploadKind } from "./uploads";

/**
 * Links people give the site: a picture's link used like an uploaded picture (fetched, then kept
 * here like any upload), and the preview a link gets (a page's title, text and picture, or the
 * picture the link is). Fetching goes through fetchPublic, which keeps it off the home network.
 */

const IMAGE_ACCEPT = "image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8";
const PAGE_ACCEPT = "text/html,application/xhtml+xml;q=0.9,image/*;q=0.8,*/*;q=0.5";
const PAGE_MAX = 1024 * 1024;
const isPage = (type: string) => type === "text/html" || type === "application/xhtml+xml";
const lang = () => (getSettings().language === "sv" ? "sv,en;q=0.8" : "en,sv;q=0.5");
const imageMax = () => getSettings().maxUploadMb * 1024 * 1024;

/** A /media/… path of this site's, from a link to it (or the path itself), or null. */
function ownMedia(input: string, origin: string): string[] | null {
  try {
    const u = new URL(input, origin);
    if (u.origin !== new URL(origin).origin || !u.pathname.startsWith("/media/")) return null;
    return decodeURIComponent(u.pathname.slice("/media/".length)).split("/");
  } catch {
    return null;
  }
}

function fileName(u: URL) {
  const last = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() ?? "").replace(/\.[a-z0-9]+$/i, "");
  return (last || u.hostname).replace(/[-_]+/g, " ").slice(0, 120);
}

async function saveImage(userId: number, f: Fetched, kind: UploadKind): Promise<Uploaded> {
  try {
    return await saveUpload(userId, f.body, kind, fileName(f.url));
  } catch (e) {
    if (e instanceof UserError) throw e;
    throw new UserError("That link isn't a picture we can use.");
  }
}

/**
 * The picture a link points to, saved as an upload of this kind. A link to a page uses the page's
 * own picture (its preview picture), unless onlyImage: then a page gives null (it stays a link).
 */
export async function importImage(userId: number, input: string, kind: UploadKind, o: { origin: string; onlyImage?: boolean }): Promise<Uploaded | null> {
  const link = input.trim();
  const own = ownMedia(link, o.origin);
  if (own) {
    const file = mediaFile(own);
    if (!file) throw new UserError("That picture isn't here any more.");
    return saveUpload(userId, fs.readFileSync(file), kind, own[own.length - 1].replace(/\.[a-z0-9]+$/i, ""));
  }
  const f = await fetchPublic(link, {
    accept: o.onlyImage ? IMAGE_ACCEPT : PAGE_ACCEPT,
    lang: lang(),
    read: (type) => (isPage(type) ? (o.onlyImage ? null : { max: PAGE_MAX, truncate: true }) : type.startsWith("text/") ? null : { max: imageMax() }),
  });
  if (isPage(f.type)) {
    if (o.onlyImage) return null;
    const page = readPage(f);
    if (!page.image) throw new UserError("That page has no picture to use.");
    const img = await fetchPublic(page.image, { accept: IMAGE_ACCEPT, lang: lang(), read: (type) => (type.startsWith("text/") ? null : { max: imageMax() }) });
    if (img.skipped) throw new UserError("That page has no picture to use.");
    return saveImage(userId, img, kind);
  }
  if (f.skipped) {
    if (o.onlyImage) return null;
    throw new UserError("That link isn't a picture we can use.");
  }
  return saveImage(userId, f, kind);
}

interface Page {
  title: string;
  description: string;
  site: string;
  image: string | null;
}

/** A page's title, description, site name and picture (OpenGraph, Twitter cards, or plain HTML). */
function readPage(f: Fetched): Page {
  let charset = f.charset;
  if (!charset) charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(f.body.subarray(0, 4096).toString("latin1"))?.[1];
  let html: string;
  try {
    html = new TextDecoder(charset || "utf-8").decode(f.body);
  } catch {
    html = new TextDecoder("utf-8").decode(f.body);
  }
  const meta: Record<string, string> = {};
  let title = "";
  let inTitle = false;
  let titleDone = false;
  const p = new Parser(
    {
      onopentag(name, a) {
        if (name === "meta") {
          const key = (a.property || a.name || a.itemprop || "").toLowerCase();
          if (key && a.content && !(key in meta)) meta[key] = a.content;
        } else if (name === "title" && !titleDone) inTitle = true;
        else if (name === "link" && /(^|\s)image_src(\s|$)/i.test(a.rel || "") && a.href && !meta["link:image_src"]) meta["link:image_src"] = a.href;
      },
      ontext(text) {
        if (inTitle) title += text;
      },
      onclosetag(name) {
        if (name === "title" && inTitle) {
          inTitle = false;
          titleDone = true;
        }
      },
    },
    { decodeEntities: true },
  );
  p.write(html);
  p.end();
  const clean = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);
  const pic = meta["og:image:secure_url"] || meta["og:image"] || meta["og:image:url"] || meta["twitter:image"] || meta["twitter:image:src"] || meta["link:image_src"];
  let image: string | null = null;
  try {
    const u = pic ? new URL(pic, f.url) : null;
    if (u && (u.protocol === "https:" || u.protocol === "http:")) image = u.toString();
  } catch {
    /* no picture */
  }
  return {
    title: clean(meta["og:title"] || meta["twitter:title"] || title, 200),
    description: clean(meta["og:description"] || meta["twitter:description"] || meta["description"] || "", 300),
    site: clean(meta["og:site_name"] || "", 80) || f.url.hostname.replace(/^www\./, ""),
    image,
  };
}

export interface LinkPreview {
  url: string;
  /** a page (title, text, maybe a picture) or a picture */
  kind: "page" | "image";
  title: string;
  description: string;
  site: string;
  /** our copy of its picture (/media/…) */
  image: string | null;
}

interface PreviewRow {
  url: string;
  kind: "page" | "image" | "none";
  title: string;
  description: string;
  site: string;
  image: string | null;
  fetched_at: number;
}

const FRESH = 3 * 86_400_000;
const RETRY = 3_600_000;

/** A link as previews are kept (no #fragment), or null if it can't have one. */
export function previewKey(input: string, origin: string): string | null {
  try {
    const u = new URL(input);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || u.origin === new URL(origin).origin || input.length > 2000) return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

const toPreview = (r: PreviewRow): LinkPreview | null => (r.kind === "none" ? null : { url: r.url, kind: r.kind, title: r.title, description: r.description, site: r.site, image: r.image });

/** What's kept for a link: its preview, null (it has none), or undefined (not fetched lately). */
export function cachedPreview(key: string): LinkPreview | null | undefined {
  const r = db().prepare("select * from link_previews where url = ?").get(key) as PreviewRow | undefined;
  if (!r || r.fetched_at < now() - (r.kind === "none" ? RETRY : FRESH)) return undefined;
  return toPreview(r);
}

// one fetch per link at a time, however many ask
const g = globalThis as typeof globalThis & { __hdPreviews?: Map<string, Promise<LinkPreview | null>> };
const inflight = (g.__hdPreviews ??= new Map());

export function linkPreview(userId: number, key: string): Promise<LinkPreview | null> {
  const cached = cachedPreview(key);
  if (cached !== undefined) return Promise.resolve(cached);
  let p = inflight.get(key);
  if (!p) {
    p = fetchPreview(userId, key).finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

async function fetchPreview(userId: number, key: string): Promise<LinkPreview | null> {
  let row: Omit<PreviewRow, "fetched_at"> = { url: key, kind: "none", title: "", description: "", site: "", image: null };
  try {
    const f = await fetchPublic(key, {
      accept: PAGE_ACCEPT,
      lang: lang(),
      read: (type) => (isPage(type) ? { max: PAGE_MAX, truncate: true } : type.startsWith("image/") ? { max: imageMax() } : null),
    });
    const site = f.url.hostname.replace(/^www\./, "");
    if (f.type.startsWith("image/") && !f.skipped) {
      const up = await saveImage(userId, f, "image");
      row = { ...row, kind: "image", title: fileName(f.url), site, image: up.thumb ?? up.url };
    } else if (isPage(f.type)) {
      const page = readPage(f);
      let image: string | null = null;
      if (page.image) {
        try {
          const img = await fetchPublic(page.image, { accept: IMAGE_ACCEPT, lang: lang(), read: (type) => (type.startsWith("text/") ? null : { max: 8 * 1024 * 1024 }) });
          if (!img.skipped) image = (await saveUpload(userId, img.body, "preview", fileName(img.url))).url;
        } catch {
          /* a preview without its picture */
        }
      }
      if (page.title || page.description || image) row = { ...row, kind: "page", title: page.title, description: page.description, site: page.site, image };
    }
  } catch {
    /* no preview (tried again in an hour) */
  }
  db()
    .prepare("insert into link_previews (url, kind, title, description, site, image, fetched_at) values (?, ?, ?, ?, ?, ?, ?) on conflict(url) do update set kind = excluded.kind, title = excluded.title, description = excluded.description, site = excluded.site, image = excluded.image, fetched_at = excluded.fetched_at")
    .run(row.url, row.kind, row.title, row.description, row.site, row.image, now());
  return toPreview({ ...row, fetched_at: now() });
}
