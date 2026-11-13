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

/**
 * How much of an Android icon shows on the home screen: of the 108 dp layer, the middle 72; of a
 * maskable icon, the middle 0.873 (Chrome makes its 80% safe zone the launcher's 66 dp). Drawn to fill
 * that as they fill the plate on the other icons, the stripes look the same there (where the launcher
 * crops to a circle, the outer ones are cut).
 */
const SHOWN = 72 / 108;
const SHOWN_MASKABLE = 0.8 * (72 / 66);

/** The six bars in a box: [x, y, width, height, corner] each. */
function barRects(x0, top, w, h) {
  const bar = w / (6 + 5 * 0.3);
  const gap = bar * 0.3;
  return STRIPES.map((_, i) => [x0 + i * (bar + gap), top, bar, h, bar * 0.12]);
}

/**
 * scale: the stripes' size about the plate's middle (the maskable icon's, to the part that shows); pad:
 * instead of the box, this share of the side left empty round them (the badge)
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
// maskable: full bleed square, the stripes as the other icons' in the part that shows
await sharp(Buffer.from(svg({ size: 512, scale: SHOWN_MASKABLE, round: 0 }))).png().toFile(new URL("icon-maskable-512.png", dir).pathname);
// iOS rounds the corners itself
await sharp(Buffer.from(svg({ size: 180, round: 0 }))).png().toFile(new URL("apple-touch-icon.png", dir).pathname);
// Unraid's Docker icon (unraid/communarr.xml points to it)
await sharp(Buffer.from(svg({ size: 512 }))).png().toFile(new URL("../../unraid/communarr.png", dir).pathname);
// Android's status bar badge: white on transparent
await sharp(Buffer.from(svg({ size: 96, pad: 0.12, bg: "", colors: Array(6).fill("#ffffff") }))).png().toFile(new URL("badge-96.png", dir).pathname);

// the desktop app (desktop/): its icon (electron-builder makes Windows' .ico from it), a Mac's (the plate
// inside Apple's grid, 824 of 1024, as the Dock's other icons), and the tray's: the plate on Windows and
// Linux, black stripes for a Mac's menu bar (a template image, which macOS colours itself), each also with
// a dot for something unread; and Windows' taskbar overlay, the dot alone
const assets = new URL("../../desktop/assets/", dir);
fs.mkdirSync(assets, { recursive: true });
const png = (s, name) => sharp(Buffer.from(s)).png().toFile(new URL(name, assets).pathname);
const dot = (size, s, color = "#e2533a", ring = "#070b10") =>
  s.replace("</svg>", `<circle cx="${size * 0.78}" cy="${size * 0.22}" r="${size * 0.21}" fill="${ring}"/><circle cx="${size * 0.78}" cy="${size * 0.22}" r="${size * 0.16}" fill="${color}"/></svg>`);
await png(svg({ size: 1024 }), "icon.png");
await png(svg({ size: 1024 }).replace(/<svg ([^>]*)>/, `<svg $1><g transform="translate(100 100) scale(${824 / 1024})">`).replace("</svg>", "</g></svg>"), "icon-mac.png");
for (const [size, suffix] of [[32, ""], [64, "@2x"]]) {
  await png(svg({ size }), `tray${suffix}.png`);
  await png(dot(size, svg({ size })), `tray-unread${suffix}.png`);
}
for (const [size, suffix] of [[16, ""], [32, "@2x"]]) {
  const black = svg({ size, pad: 0.1, bg: "", colors: Array(6).fill("#000000") });
  await png(black, `trayTemplate${suffix}.png`);
  // (a template is one colour: a gap cut round the dot, so it shows against the stripes)
  const [cx, cy] = [size * 0.78, size * 0.22];
  const cut = `<mask id="m"><rect width="${size}" height="${size}" fill="#fff"/><circle cx="${cx}" cy="${cy}" r="${size * 0.25}" fill="#000"/></mask>`;
  const holed = black.replace("<defs>", `<defs>${cut}`).replace(/<rect x=/g, '<rect mask="url(#m)" x=');
  await png(holed.replace("</svg>", `<circle cx="${cx}" cy="${cy}" r="${size * 0.17}" fill="#000000"/></svg>`), `trayUnreadTemplate${suffix}.png`);
}
await png(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="7" fill="#070b10"/><circle cx="8" cy="8" r="5.5" fill="#e2533a"/></svg>`, "overlay-unread.png");

// Android's launcher icon (on the launcher's background colour), its themed icon and the app's logo, as
// vectors on the same 512 grid: the launcher's as the other icons' in the 72 dp that show
const f = (n) => Math.round(n * 1000) / 1000;
const R = (x, y, w, h, r) => `M${f(x + r)},${f(y)}h${f(w - 2 * r)}a${f(r)},${f(r)} 0,0 1,${f(r)},${f(r)}v${f(h - 2 * r)}a${f(r)},${f(r)} 0,0 1,${f(-r)},${f(r)}h${f(-(w - 2 * r))}a${f(r)},${f(r)} 0,0 1,${f(-r)},${f(-r)}v${f(-(h - 2 * r))}a${f(r)},${f(r)} 0,0 1,${f(r)},${f(-r)}z`;
const box = [512 * BOX.x, 512 * BOX.top, 512 * (1 - 2 * BOX.x), 512 * BOX.height];
const paths = (fill) => barRects(...box).map(([x, y, w, h, r], i) => `        <path android:fillColor="${fill ?? STRIPES[i]}" android:pathData="${R(x, y, w, h, r)}" />`).join("\n");
const k = SHOWN;
const group = (fill) => `    <group android:scaleX="${f(k)}" android:scaleY="${f(k)}" android:translateX="${f(256 - (box[0] + box[2] / 2) * k)}" android:translateY="${f(256 - (box[1] + box[3] / 2) * k)}">\n${paths(fill)}\n    </group>`;
const vector = (dp, comment, body) => `<?xml version="1.0" encoding="utf-8"?>\n<!-- ${comment} -->\n<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="${dp}dp" android:height="${dp}dp" android:viewportWidth="512" android:viewportHeight="512">\n${body}\n</vector>\n`;
const res = new URL("../../android/app/src/main/res/drawable/", dir);
fs.writeFileSync(new URL("ic_launcher_foreground.xml", res), vector(108, "the site's stripes (scripts/icons.mjs), on the launcher's background", group()));
fs.writeFileSync(new URL("ic_launcher_monochrome.xml", res), vector(108, "the site's stripes in one colour, for Android's themed icons (scripts/icons.mjs)", group("#ffffff")));
fs.writeFileSync(new URL("logo.xml", res), vector(72, "the site's icon (scripts/icons.mjs)",
  `    <path android:fillColor="#121b23" android:pathData="${R(0, 0, 512, 512, 112.64)}" />\n${paths().replace(/^ {4}/gm, "")}`));
console.log("icons written");
