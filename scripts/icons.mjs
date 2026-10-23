// Draws the app icons (public/icons): the six stripes on deep navy, like the header's mark.
// Run: node scripts/icons.mjs
import fs from "node:fs";
import sharp from "sharp";

const STRIPES = ["#efe3c8", "#e2a634", "#cc4a30", "#4f8f50", "#2f74a0", "#2d2833"];
const dir = new URL("../public/icons/", import.meta.url);
fs.mkdirSync(dir, { recursive: true });

/** pad: share of the side left empty around the mark (maskable icons need a safe zone) */
function svg({ size = 512, pad = 0.2, round = 0.22, bg = "#070b10", colors = STRIPES } = {}) {
  const inner = size * (1 - pad * 2);
  const bar = inner / (6 + 5 * 0.3);
  const gap = bar * 0.3;
  const x0 = (size - inner) / 2;
  const top = size * pad * 0.9;
  const h = size - top * 2;
  const bars = colors.map((c, i) => `<rect x="${x0 + i * (bar + gap)}" y="${top}" width="${bar}" height="${h}" rx="${bar * 0.12}" fill="${c}"/>`).join("");
  const glow = `<radialGradient id="g" cx="80%" cy="105%" r="70%"><stop offset="0" stop-color="#d65a2b" stop-opacity=".35"/><stop offset="1" stop-color="#d65a2b" stop-opacity="0"/></radialGradient>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs>${glow}</defs>${bg ? `<rect width="${size}" height="${size}" rx="${size * round}" fill="${bg}"/><rect width="${size}" height="${size}" rx="${size * round}" fill="url(#g)"/>` : ""}${bars}</svg>`;
}

const write = (name, data) => fs.writeFileSync(new URL(name, dir), data);
write("icon.svg", svg({ size: 512, pad: 0.2 }));
await sharp(Buffer.from(svg({ size: 512, pad: 0.2 }))).png().toFile(new URL("icon-512.png", dir).pathname);
await sharp(Buffer.from(svg({ size: 192, pad: 0.2 }))).png().toFile(new URL("icon-192.png", dir).pathname);
// maskable: full bleed square, the mark inside the safe zone
await sharp(Buffer.from(svg({ size: 512, pad: 0.28, round: 0 }))).png().toFile(new URL("icon-maskable-512.png", dir).pathname);
// iOS rounds the corners itself
await sharp(Buffer.from(svg({ size: 180, pad: 0.2, round: 0 }))).png().toFile(new URL("apple-touch-icon.png", dir).pathname);
// Android's status bar badge: white on transparent
await sharp(Buffer.from(svg({ size: 96, pad: 0.12, bg: "", colors: Array(6).fill("#ffffff") }))).png().toFile(new URL("badge-96.png", dir).pathname);
console.log("icons written");
