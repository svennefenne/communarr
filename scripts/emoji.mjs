// Builds the emoji picker's lists from emojibase-data: [emoji, name, group, tags] in Unicode's
// order, without the skin-tone components. src/lib/emoji.json is English; src/lib/emoji.<lang>.json
// has that language's names and tags (plus the English name, so English searches still work).
// Run: node scripts/emoji.mjs
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const en = require("emojibase-data/en/compact.json")
  .filter((e) => e.group !== undefined && e.group !== 2)
  .sort((a, b) => a.order - b.order);

const write = (file, rows) => fs.writeFileSync(new URL(`../src/lib/${file}`, import.meta.url), JSON.stringify(rows));
const tags = (e) => (e.tags || []).filter((t) => !e.label.includes(t));

write("emoji.json", en.map((e) => [e.unicode, e.label, e.group, tags(e).join(" ")]));
console.log(`emoji.json: ${en.length} emoji`);

for (const lang of ["sv"]) {
  const local = new Map(require(`emojibase-data/${lang}/compact.json`).map((e) => [e.hexcode, e]));
  const rows = en.map((e) => {
    const l = local.get(e.hexcode);
    return l ? [e.unicode, l.label, e.group, [...tags(l), e.label].join(" ")] : [e.unicode, e.label, e.group, tags(e).join(" ")];
  });
  write(`emoji.${lang}.json`, rows);
  console.log(`emoji.${lang}.json: ${rows.length} emoji, ${rows.filter((r, i) => r[1] !== en[i].label).length} with ${lang} names`);
}
