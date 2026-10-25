// Builds src/lib/noto.json, the animated emoji members can add as the site's own (Add an emoji →
// Google's animated emoji): [codepoint, name, group] for Google's Animated Noto Emoji (CC BY 4.0,
// https://googlefonts.github.io/noto-emoji-animation/), most used first, without the skin-tone
// variants. The group is the emoji picker's (0 smileys … 9 flags). The pictures themselves are
// fetched when someone picks one: https://fonts.gstatic.com/s/e/notoemoji/latest/<codepoint>/512.webp
// Run: node scripts/noto-emoji.mjs
import fs from "node:fs";

const GROUPS = {
  "Smileys and emotions": 0,
  People: 1,
  "Animals and nature": 3,
  "Food and drink": 4,
  "Travel and places": 5,
  "Activities and events": 6,
  Objects: 7,
  Symbols: 8,
  Flags: 9,
};

// a name the site's emoji can have (a–z, digits, _; 2–32): ":Piñata:" → "pinata", and a long one cut
// at a word
function emojiName(tag) {
  let n = tag
    .replace(/^:|:$/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  while (n.length > 32 && n.includes("_")) n = n.slice(0, n.lastIndexOf("_"));
  return n.slice(0, 32);
}

const res = await fetch("https://googlefonts.github.io/noto-emoji-animation/data/api.json");
if (!res.ok) throw new Error(`api.json: ${res.status}`);
const { icons } = await res.json();
const rows = icons
  .filter((i) => /^[0-9a-f_]+$/.test(i.codepoint) && !/1f3f[b-f]/.test(i.codepoint))
  .sort((a, b) => b.popularity - a.popularity)
  .map((i) => [i.codepoint, emojiName(i.tags[0]), GROUPS[i.categories[0]] ?? 7]);
const names = new Set(rows.map((r) => r[1]));
if (names.size !== rows.length) throw new Error("two with the same name");
const bad = rows.filter((r) => !/^[a-z0-9_]{2,32}$/.test(r[1]));
if (bad.length) throw new Error(`names that won't do: ${JSON.stringify(bad)}`);
fs.writeFileSync(new URL("../src/lib/noto.json", import.meta.url), JSON.stringify(rows));
console.log(`noto.json: ${rows.length} animated emoji`);
