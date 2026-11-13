// The desktop app for this computer's kind, or the one named, into release/ (what the workflow runs):
//   node scripts/build.mjs --linux | --win | --mac
import { builder, here } from "./builder.mjs";

const TARGETS = {
  "--linux": { linux: ["AppImage"], x64: true },
  "--win": { win: ["nsis"], x64: true },
  "--mac": { mac: ["zip"], arm64: true },
};
const flag = process.argv[2] ?? (process.platform === "win32" ? "--win" : process.platform === "darwin" ? "--mac" : "--linux");
if (!TARGETS[flag]) {
  console.error("usage: node scripts/build.mjs --linux | --win | --mac");
  process.exit(1);
}
await builder().build({ projectDir: here, publish: "never", ...TARGETS[flag] });
