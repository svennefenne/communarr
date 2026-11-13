// The desktop app under a site's own name, for its server: a name of its own (in its menus, its window,
// its installer), an id of its own (so it installs beside Communarr) and the site's address, where it
// goes straight away (resources/site.json, which src/site.ts reads). Run on Linux:
//
// - Linux and Windows: built from this checkout (the AppImage, and the Windows installer without Wine:
//   electron-builder edits the program itself and reads the uninstaller out of the installer as it does
//   on a Mac);
// - macOS: Communarr's own build for this version from GitHub (a Mac's app can only be built on a Mac),
//   renamed, and signed again ad hoc with rcodesign (pinned below, checked against its digest).
//
//   node scripts/site-copy.mjs <name> <app id> <site address> <out dir> [--mac-zip <file>]
//   e.g. node scripts/site-copy.mjs Friends com.example.friends https://friends.example /tmp/out
// The files: <name>-desktop-<version>-linux-x86_64.AppImage, …-windows-x64-setup.exe, …-macos-arm64.zip
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const here = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const macZipAt = args.indexOf("--mac-zip");
const macZip = macZipAt >= 0 ? args.splice(macZipAt, 2)[1] : null;
const [name, id, address, out] = args;
const usage = () => {
  console.error("usage: node scripts/site-copy.mjs <name> <app id> <site address> <out dir> [--mac-zip <file>]");
  process.exit(1);
};
if (!out) usage();
const { parseSite, slug } = require(path.join(here, "dist", "site.js"));
const site = parseSite(JSON.stringify({ name, id, server: address }));
if (!site || !site.server) {
  console.error("The name (letters, digits, spaces, . _ -), the id (com.example.friends) or the address (https://…) isn't one.");
  process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(path.join(here, "package.json"), "utf8"));
const version = pkg.version;
const file = (end) => `${slug(site.name)}-desktop-${version}-${end}`;
fs.mkdirSync(out, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), "site-copy-"));
const siteJson = path.join(work, "site.json");
fs.writeFileSync(siteJson, JSON.stringify(site, null, 2) + "\n");
const sha256 = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

// ------------------------------------------------------------ Linux and Windows, from this checkout

// (electron-builder runs the Windows installer under Wine to get its uninstaller out, except on a Mac,
// where it reads it out of the file itself: it does that here too)
const macosVersion = require(path.join(here, "node_modules", "app-builder-lib", "out", "util", "macosVersion.js"));
macosVersion.isMacOsCatalina = () => true;
const { build } = require(path.join(here, "node_modules", "electron-builder"));
const config = structuredClone(pkg.build);
Object.assign(config, {
  appId: site.id,
  productName: site.name,
  directories: { output: path.join(work, "release") },
  extraResources: [{ from: siteJson, to: "site.json" }],
  // (the package's name is the Windows installation's folder: one of its own, beside Communarr's)
  extraMetadata: { name: `${slug(site.name)}-desktop`, productName: site.name, desktopName: `${site.id}.desktop` },
});
config.linux = { ...config.linux, executableName: slug(site.name), artifactName: file("linux-x86_64.AppImage"), desktop: { entry: { StartupWMClass: site.id } } };
config.win = { ...config.win, artifactName: file("windows-x64-setup.exe") };
await build({ projectDir: here, linux: ["AppImage"], win: ["nsis"], x64: true, publish: "never", config });
for (const end of ["linux-x86_64.AppImage", "windows-x64-setup.exe"]) fs.copyFileSync(path.join(work, "release", file(end)), path.join(out, file(end)));

// ------------------------------------------------------------ macOS, from Communarr's own build

const RCODESIGN = {
  url: "https://github.com/indygreg/apple-platform-rs/releases/download/apple-codesign%2F0.29.0/apple-codesign-0.29.0-x86_64-unknown-linux-musl.tar.gz",
  sha256: "dbe85cedd8ee4217b64e9a0e4c2aef92ab8bcaaa41f20bde99781ff02e600002",
  bin: "apple-codesign-0.29.0-x86_64-unknown-linux-musl/rcodesign",
};

async function fetchFile(url, to, want) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  fs.writeFileSync(to, Buffer.from(await r.arrayBuffer()));
  if (want && sha256(to) !== want) throw new Error(`${url} isn't the file it should be`);
}

async function rcodesign() {
  const dir = path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "communarr-desktop");
  const bin = path.join(dir, RCODESIGN.bin);
  if (fs.existsSync(bin)) return bin;
  fs.mkdirSync(dir, { recursive: true });
  const tgz = path.join(dir, "rcodesign.tar.gz");
  await fetchFile(RCODESIGN.url, tgz, RCODESIGN.sha256);
  execFileSync("tar", ["-xzf", tgz, "-C", dir]);
  fs.rmSync(tgz);
  return bin;
}

/** One string in an XML plist, set (or added). */
function plistString(xml, key, value) {
  const esc = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const at = new RegExp(`(<key>${key}</key>\\s*<string>)[^<]*(</string>)`);
  return at.test(xml) ? xml.replace(at, `$1${esc}$2`) : xml.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>${key}</key>\n\t<string>${esc}</string>\n</dict>\n</plist>\n`);
}

async function mac() {
  let zip = macZip;
  if (!zip) {
    const tag = `desktop-v${version}`;
    const r = await fetch(`https://api.github.com/repos/svennefenne/communarr/releases/tags/${tag}`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "Communarr" } });
    if (!r.ok) throw new Error(`GitHub has no release ${tag} yet (HTTP ${r.status}): the Mac's copy is made from it`);
    const asset = (await r.json()).assets?.find((a) => a.name === "communarr-desktop-macos-arm64.zip");
    if (!asset) throw new Error(`release ${tag} has no Mac build`);
    zip = path.join(work, asset.name);
    await fetchFile(asset.browser_download_url, zip, asset.digest?.replace(/^sha256:/, ""));
  }
  const dir = path.join(work, "mac");
  fs.mkdirSync(dir);
  execFileSync("unzip", ["-q", zip, "-d", dir]);
  const from = fs.readdirSync(dir).find((f) => f.endsWith(".app"));
  if (!from) throw new Error("the Mac's zip has no app in it");
  const app = path.join(dir, `${site.name}.app`);
  if (from !== path.basename(app)) fs.renameSync(path.join(dir, from), app);
  const plist = path.join(app, "Contents", "Info.plist");
  let xml = fs.readFileSync(plist, "utf8");
  if (!xml.startsWith("<?xml")) throw new Error("the app's Info.plist isn't XML");
  for (const [k, v] of [["CFBundleName", site.name], ["CFBundleDisplayName", site.name], ["CFBundleIdentifier", site.id]]) xml = plistString(xml, k, v);
  fs.writeFileSync(plist, xml);
  fs.copyFileSync(siteJson, path.join(app, "Contents", "Resources", "site.json"));
  const rc = await rcodesign();
  execFileSync(rc, ["sign", app], { stdio: ["ignore", "ignore", "inherit"] });
  // signed again: the app's program carries an ad hoc signature of its own (no longer the linker's), and
  // the app's files are sealed with it (rcodesign's verify can't judge an ad hoc signature)
  const exe = xml.match(/<key>CFBundleExecutable<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
  if (!exe) throw new Error("the app's Info.plist names no program");
  const info = execFileSync(rc, ["print-signature-info", path.join(app, "Contents", "MacOS", exe)], { stdio: ["ignore", "pipe", "ignore"] }).toString();
  if (!/ADHOC/.test(info) || /LINKER_SIGNED/.test(info) || !fs.existsSync(path.join(app, "Contents", "_CodeSignature", "CodeResources")))
    throw new Error("the app wasn't signed again");
  const target = path.join(path.resolve(out), file("macos-arm64.zip"));
  fs.rmSync(target, { force: true });
  execFileSync("zip", ["-qry", target, path.basename(app)], { cwd: dir });
}

let macMade = true;
try {
  await mac();
} catch (e) {
  macMade = false;
  console.warn(`No Mac copy: ${e.message}`);
}
fs.rmSync(work, { recursive: true, force: true });
for (const f of fs.readdirSync(out).filter((f) => f.startsWith(`${slug(site.name)}-desktop-${version}-`))) console.log(`${path.join(out, f)}  ${(fs.statSync(path.join(out, f)).size / 1e6).toFixed(0)} MB`);
if (!macMade) process.exitCode = 2;
