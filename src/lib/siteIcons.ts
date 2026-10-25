import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { DATA_DIR } from "./db";
import { palette } from "./palettes";
import { getSettings } from "./settings";
import { mediaFile } from "./uploads";

/**
 * The site's icons (the browser tab, the app on a phone's home screen, notifications): the six stripes
 * that ship with it, or, once an admin has picked a logo, ones cut from it at each size, kept in
 * DATA_DIR/cache/icons and served by /icons/site/<name>.
 */

interface IconSpec {
  size: number;
  /** the stripes' file in public/icons */
  stripes: string;
  /** on the site's background colour, with this much room round the logo (phones crop and round these) */
  pad?: number;
}

const ICONS: Record<string, IconSpec> = {
  "192.png": { size: 192, stripes: "icon-192.png" },
  "512.png": { size: 512, stripes: "icon-512.png" },
  "maskable-512.png": { size: 512, stripes: "icon-maskable-512.png", pad: 0.2 },
  "apple-180.png": { size: 180, stripes: "apple-touch-icon.png", pad: 0.1 },
};

/** Where the icons are, with a version in the address once they're the logo's (a new logo, new icons). */
export function siteIcons() {
  const logo = getSettings().logo;
  if (!logo) return { icon192: "/icons/icon-192.png", icon512: "/icons/icon-512.png", maskable: "/icons/icon-maskable-512.png", apple: "/icons/apple-touch-icon.png", svg: "/icons/icon.svg" as string | null };
  const v = crypto.createHash("sha1").update(logo).digest("hex").slice(0, 10);
  const at = (name: string) => `/icons/site/${name}?v=${v}`;
  return { icon192: at("192.png"), icon512: at("512.png"), maskable: at("maskable-512.png"), apple: at("apple-180.png"), svg: null as string | null };
}

/** An icon's PNG by its name ("192.png", …), or null for a name that isn't one. */
export async function siteIcon(name: string): Promise<Buffer | null> {
  const spec = ICONS[name];
  if (!spec) return null;
  const s = getSettings();
  const logo = s.logo ? mediaFile(s.logo.replace(/^\/media\//, "").split("/")) : null;
  // (turbopackIgnore: the running server's own files, nothing to bundle)
  if (!logo) return fs.readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "icons", spec.stripes));
  const bg = palette(s.defaultScheme).dark.bg;
  const key = crypto.createHash("sha1").update(`${s.logo}|${name}|${bg}`).digest("hex").slice(0, 20);
  const dir = path.join(/*turbopackIgnore: true*/ DATA_DIR, "cache", "icons");
  const file = path.join(dir, `${key}.png`);
  if (fs.existsSync(file)) return fs.readFileSync(file);
  const clear = { r: 0, g: 0, b: 0, alpha: 0 };
  let png: Buffer;
  if (!spec.pad) png = await sharp(logo).resize(spec.size, spec.size, { fit: "contain", background: clear }).png().toBuffer();
  else {
    const inner = Math.round(spec.size * (1 - 2 * spec.pad));
    const mark = await sharp(logo).resize(inner, inner, { fit: "contain", background: clear }).png().toBuffer();
    png = await sharp({ create: { width: spec.size, height: spec.size, channels: 4, background: bg } })
      .composite([{ input: mark, gravity: "centre" }])
      .png()
      .toBuffer();
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, png);
  return png;
}
