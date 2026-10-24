// Copies what the browser loads for strong noise suppression in voice chat (RNNoise, through
// @sapphi-red/web-noise-suppressor) into public/voice/vendor/: the audio worklet and its two wasm
// builds. Runs before every build and dev start (npm prebuild/predev); the copies aren't in git.
// Run: node scripts/voice-assets.mjs
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const from = path.join(root, "node_modules/@sapphi-red/web-noise-suppressor/dist");
const to = path.join(root, "public/voice/vendor");
const files = [
  ["rnnoise/workletProcessor.js", "rnnoise-worklet.js"],
  ["rnnoise.wasm", "rnnoise.wasm"],
  ["rnnoise_simd.wasm", "rnnoise_simd.wasm"],
];
fs.mkdirSync(to, { recursive: true });
for (const [src, dest] of files) fs.copyFileSync(path.join(from, src), path.join(to, dest));
console.log(`voice assets: ${files.length} files in public/voice/vendor`);
