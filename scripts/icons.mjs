// Draws the app icons (public/icons, and Unraid's): the six stripes on deep navy, like the header's mark.
// Run: node scripts/icons.mjs
import fs from "node:fs";
import sharp from "sharp";

const STRIPES = ["#efe3c8", "#e2a634", "#cc4a30", "#4f8f50", "#2f74a0", "#5a5066"];
const dir = new URL("../public/icons/", import.meta.url);
fs.mkdirSync(dir, { recursive: true });

/**
 * Where the stripes sit on the plate, as shares of its side: the same box as Muzix's cassette and Deck
 * Force's stripes, so the three icons are the same size side by side (muzix/scripts/icons.py).
 */
const BOX = { x: 0.03875, top: 0.15047, height: 0.73031 };

/** The six bars in a box: [x, y, width, height, corner] each. */
function barRects(x0, top, w, h) {
  const bar = w / (6 + 5 * 0.3);
  const gap = bar * 0.3;
  return STRIPES.map((_, i) => [x0 + i * (bar + gap), top, bar, h, bar * 0.12]);
}

/**
 * scale: the stripes' size about the plate's middle (the maskable icon draws them smaller, inside the
 * circle phones crop to); pad: instead of the box, this share of the side left empty round them (the badge)
 */
function svg({ size = 512, scale = 1, pad = 0, round = 0.22, bg = "#070b10", colors = STRIPES } = {}) {
  let x0 = size * BOX.x, w = size * (1 - 2 * BOX.x), top = size * BOX.top, h = size * BOX.height;
  if (pad) [x0, w, top] = [size * pad, size * (1 - 2 * pad), size * pad * 0.9], h = size - top * 2;
  if (scale !== 1) [w, h] = [w * scale, h * scale], [x0, top] = [(size - w) / 2, (size - h) / 2];
  const bars = barRects(x0, top, w, h).map(([x, y, bw, bh, r], i) => `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="${r}" fill="${colors[i]}"/>`).join("");
  const glow = `<radialGradient id="g" cx="80%" cy="105%" r="70%"><stop offset="0" stop-color="#d65a2b" stop-opacity=".35"/><stop offset="1" stop-color="#d65a2b" stop-opacity="0"/></radialGradient>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs>${glow}</defs>${bg ? `<rect width="${size}" height="${size}" rx="${size * round}" fill="${bg}"/><rect width="${size}" height="${size}" rx="${size * round}" fill="url(#g)"/>` : ""}${bars}</svg>`;
}

const write = (name, data) => fs.writeFileSync(new URL(name, dir), data);
write("icon.svg", svg({ size: 512 }));
await sharp(Buffer.from(svg({ size: 512 }))).png().toFile(new URL("icon-512.png", dir).pathname);
await sharp(Buffer.from(svg({ size: 192 }))).png().toFile(new URL("icon-192.png", dir).pathname);
// maskable: full bleed square, the stripes inside the circle phones crop to (as Muzix's)
await sharp(Buffer.from(svg({ size: 512, scale: 0.66, round: 0 }))).png().toFile(new URL("icon-maskable-512.png", dir).pathname);
// iOS rounds the corners itself
await sharp(Buffer.from(svg({ size: 180, round: 0 }))).png().toFile(new URL("apple-touch-icon.png", dir).pathname);
// Unraid's Docker icon (unraid/communarr.xml points to it)
await sharp(Buffer.from(svg({ size: 512 }))).png().toFile(new URL("../../unraid/communarr.png", dir).pathname);
// Android's status bar badge: white on transparent
await sharp(Buffer.from(svg({ size: 96, pad: 0.12, bg: "", colors: Array(6).fill("#ffffff") }))).png().toFile(new URL("badge-96.png", dir).pathname);

// Android's launcher icon (on the launcher's background colour), its themed icon and the app's logo, as
// vectors on the same 512 grid: the launcher's at Muzix's size, its corners inside the 66 dp circle every
// launcher shape keeps
const f = (n) => Math.round(n * 1000) / 1000;
const R = (x, y, w, h, r) => `M${f(x + r)},${f(y)}h${f(w - 2 * r)}a${f(r)},${f(r)} 0,0 1,${f(r)},${f(r)}v${f(h - 2 * r)}a${f(r)},${f(r)} 0,0 1,${f(-r)},${f(r)}h${f(-(w - 2 * r))}a${f(r)},${f(r)} 0,0 1,${f(-r)},${f(-r)}v${f(-(h - 2 * r))}a${f(r)},${f(r)} 0,0 1,${f(r)},${f(-r)}z`;
const box = [512 * BOX.x, 512 * BOX.top, 512 * (1 - 2 * BOX.x), 512 * BOX.height];
const paths = (fill) => barRects(...box).map(([x, y, w, h, r], i) => `        <path android:fillColor="${fill ?? STRIPES[i]}" android:pathData="${R(x, y, w, h, r)}" />`).join("\n");
const k = (33 * 512 / 108) / Math.hypot(box[2] / 2, box[3] / 2);
const group = (fill) => `    <group android:scaleX="${f(k)}" android:scaleY="${f(k)}" android:translateX="${f(256 - (box[0] + box[2] / 2) * k)}" android:translateY="${f(256 - (box[1] + box[3] / 2) * k)}">\n${paths(fill)}\n    </group>`;
const vector = (dp, comment, body) => `<?xml version="1.0" encoding="utf-8"?>\n<!-- ${comment} -->\n<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="${dp}dp" android:height="${dp}dp" android:viewportWidth="512" android:viewportHeight="512">\n${body}\n</vector>\n`;
const res = new URL("../../android/app/src/main/res/drawable/", dir);
fs.writeFileSync(new URL("ic_launcher_foreground.xml", res), vector(108, "the site's stripes (scripts/icons.mjs), on the launcher's background", group()));
fs.writeFileSync(new URL("ic_launcher_monochrome.xml", res), vector(108, "the site's stripes in one colour, for Android's themed icons (scripts/icons.mjs)", group("#ffffff")));
fs.writeFileSync(new URL("logo.xml", res), vector(72, "the site's icon (scripts/icons.mjs)",
  `    <path android:fillColor="#121b23" android:pathData="${R(0, 0, 512, 512, 112.64)}" />\n${paths().replace(/^ {4}/gm, "")}`));
console.log("icons written");
