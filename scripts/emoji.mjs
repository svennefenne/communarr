// Builds src/lib/emoji.json (the emoji picker's list) from emojibase-data: [emoji, name, group, tags]
// in Unicode's order, without the skin-tone components. Run: node scripts/emoji.mjs
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const data = require("emojibase-data/en/compact.json");
const out = data
  .filter((e) => e.group !== undefined && e.group !== 2)
  .sort((a, b) => a.order - b.order)
  .map((e) => [e.unicode, e.label, e.group, (e.tags || []).filter((t) => !e.label.includes(t)).join(" ")]);
fs.writeFileSync(new URL("../src/lib/emoji.json", import.meta.url), JSON.stringify(out));
console.log(`${out.length} emoji`);
