// Builds src/i18n/places.json: for every built-in text (the English keys of the Swedish dictionary),
// the source files it's written in, so Admin → Texts can say on which page a text shows up
// (src/lib/textPlaces.ts turns the files into page names). Runs before every build (npm prebuild).
// Run: node scripts/text-places.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const src = path.join(root, "src");

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });

// the keys: every English text the Swedish dictionaries translate
const keys = new Set();
for (const f of fs.readdirSync(path.join(src, "i18n/sv")).filter((f) => f.endsWith(".ts") && f !== "index.ts")) {
  const sf = ts.createSourceFile(f, fs.readFileSync(path.join(src, "i18n/sv", f), "utf8"), ts.ScriptTarget.Latest, true);
  const visit = (n) => {
    if (ts.isPropertyAssignment(n) && ts.isObjectLiteralExpression(n.parent)) {
      const k = ts.isStringLiteral(n.name) || ts.isNoSubstitutionTemplateLiteral(n.name) ? n.name.text : ts.isIdentifier(n.name) ? n.name.text : null;
      if (k !== null) keys.add(k);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

// every string written in the code, and the files it's in
const places = {};
for (const file of walk(src)) {
  const rel = path.relative(src, file).replaceAll(path.sep, "/");
  if (rel.startsWith("i18n/") || rel.startsWith("app/api/dev/")) continue;
  const sf = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const seen = new Set();
  const visit = (n) => {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && keys.has(n.text)) seen.add(n.text);
    // JSX text that is itself a key (rare, but cheap to catch)
    if (ts.isJsxText(n) && keys.has(n.text.trim())) seen.add(n.text.trim());
    ts.forEachChild(n, visit);
  };
  visit(sf);
  for (const k of seen) (places[k] ??= []).push(rel);
}
for (const k of Object.keys(places)) places[k].sort();

fs.writeFileSync(path.join(src, "i18n/places.json"), JSON.stringify(places) + "\n");
const found = Object.keys(places).length;
console.log(`places.json: ${found} of ${keys.size} texts placed`);
