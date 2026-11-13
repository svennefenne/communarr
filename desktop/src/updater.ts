import { app, dialog, shell, type BrowserWindow } from "electron";
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PLATFORM, slug, trusted, updateFile, type Site } from "./site";
import { t } from "./text";

/**
 * Updating itself, when the site's menu says Update: the new version's file from the server (a server's
 * own copy from its data folder, Communarr's on to GitHub's release), checked against the digest the
 * server gave, put in place of this one, and started again where it was (the same page, or only in the
 * tray), opening nothing.
 *
 * - Linux: the AppImage it runs from is replaced (the running app carries on from the old file).
 * - Windows: the installer runs silently for this user, into the same folder, and starts the app again.
 * - macOS: the app in its folder is swapped for the new one.
 *
 * Run from source, or from a place it may not write to, it can't: the file opens in the browser instead.
 */

export interface UpdateRequest {
  url: string;
  version: string;
  sha256: string;
  server: string;
  site: Site;
  win: BrowserWindow | null;
  /** just before it ends: what to start again with */
  before: () => void;
  quit: () => void;
}

const RESUME = "resume.json";
let busy = false;

/** What this copy replaces: the AppImage, the installed app's folder or the app bundle; null where it can't. */
function target(): string | null {
  const writable = (dir: string) => {
    try {
      fs.accessSync(dir, fs.constants.W_OK);
      const probe = path.join(dir, `.write-test-${process.pid}`);
      fs.writeFileSync(probe, "");
      fs.rmSync(probe);
      return true;
    } catch {
      return false;
    }
  };
  if (!app.isPackaged) return null;
  if (process.platform === "linux") {
    const img = process.env.APPIMAGE ? fs.realpathSync(process.env.APPIMAGE) : "";
    return img && fs.statSync(img).isFile() && writable(path.dirname(img)) ? img : null;
  }
  if (process.platform === "win32") {
    const dir = path.dirname(process.execPath);
    return fs.readdirSync(dir).some((f) => /^Uninstall .+\.exe$/i.test(f)) && writable(dir) ? dir : null;
  }
  const m = process.execPath.match(/^(.+?\.app)\/Contents\/MacOS\//);
  return m && writable(path.dirname(m[1])) ? m[1] : null;
}

/** The file, following its redirects (each a place it may lead), checked against its digest. */
async function download(start: URL, server: string, sha256: string, to: string, progress: (f: number) => void) {
  let url = start;
  let r: Response;
  for (let hops = 0; ; hops++) {
    if (!trusted(url, server)) throw new Error(`it led somewhere else (${url.host})`);
    r = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30 * 60_000) });
    const next = r.headers.get("location");
    if (r.status >= 300 && r.status < 400 && next && hops < 5) {
      url = new URL(next, url);
      continue;
    }
    break;
  }
  if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
  const total = Number(r.headers.get("content-length")) || 0;
  const hash = crypto.createHash("sha256");
  const out = fs.createWriteStream(to);
  let got = 0;
  try {
    for await (const chunk of r.body as unknown as AsyncIterable<Uint8Array>) {
      hash.update(chunk);
      got += chunk.length;
      if (!out.write(chunk)) await new Promise<void>((res) => out.once("drain", () => res()));
      if (total) progress(got / total);
    }
  } finally {
    await new Promise<void>((res) => out.end(() => res()));
  }
  if (hash.digest("hex") !== sha256) {
    fs.rmSync(to, { force: true });
    throw new Error(t("The download isn't the right file."));
  }
}

/** The environment of the new start, without what this AppImage's run put in it, and with AppImageLauncher asking nothing. */
function cleanEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, APPIMAGELAUNCHER_DISABLE: "1" };
  const dir = env.APPDIR;
  for (const k of ["APPDIR", "APPIMAGE", "ARGV0", "OWD"]) delete env[k];
  if (dir) {
    for (const [k, v] of Object.entries(env)) {
      if (!v?.includes(dir)) continue;
      const kept = v.split(path.delimiter).filter((p) => !p.startsWith(dir));
      if (kept.length) env[k] = kept.join(path.delimiter);
      else delete env[k];
    }
  }
  return env;
}

const detached = (cmd: string, args: string[], env = process.env) => spawn(cmd, args, { detached: true, stdio: "ignore", env, windowsHide: true }).unref();

export async function update(req: UpdateRequest) {
  if (busy) return;
  const file = updateFile(req.url, req.server);
  if (!file || !/^[a-f0-9]{64}$/.test(req.sha256)) return;
  const into = target();
  if (!into) {
    await dialog.showMessageBox({ type: "info", message: t("This copy of {name} can't replace itself where it is, so the new version opens in the browser: install it over this one.", { name: req.site.name }) });
    void shell.openExternal(file.toString());
    return;
  }
  busy = true;
  const win = req.win;
  const bar = (f: number) => win && !win.isDestroyed() && win.setProgressBar(f);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `${slug(req.site.name)}-update-`));
  try {
    // (the AppImage beside the old one, so it can be renamed over it)
    const to = PLATFORM === "linux-x86_64" ? path.join(path.dirname(into), `.${path.basename(into)}.update`) : path.join(tmp, path.basename(file.pathname));
    bar(0);
    await download(file, req.server, req.sha256, to, bar);
    bar(-1);
    req.before();
    const pid = String(process.pid);
    if (PLATFORM === "linux-x86_64") {
      fs.chmodSync(to, 0o755);
      fs.renameSync(to, into);
      detached("/bin/sh", ["-c", 'while kill -0 "$1" 2>/dev/null; do sleep 0.2; done; exec "$2"', "sh", pid, into], cleanEnv());
    } else if (PLATFORM === "windows-x64") {
      const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
      const script = [
        `Wait-Process -Id ${pid} -Timeout 120 -ErrorAction SilentlyContinue`,
        `Start-Process -FilePath ${q(to)} -ArgumentList '/S','--updated','--force-run' -Wait`,
        `Remove-Item -LiteralPath ${q(tmp)} -Recurse -Force -ErrorAction SilentlyContinue`,
      ].join("\n");
      detached("powershell.exe", ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")]);
    } else {
      const out = path.join(tmp, "new");
      const unzip = spawnSync("/usr/bin/ditto", ["-x", "-k", to, out]);
      const bundle = unzip.status === 0 ? fs.readdirSync(out).find((f) => f.endsWith(".app")) : undefined;
      if (!bundle) throw new Error("the download has no app in it");
      fs.rmSync(to);
      const swap = [
        'pid=$1 app=$2 new=$3 tmp=$4',
        'while kill -0 "$pid" 2>/dev/null; do sleep 0.2; done',
        'rm -rf "$app.old"',
        'if mv "$app" "$app.old"; then if mv "$new" "$app"; then rm -rf "$app.old"; else mv "$app.old" "$app"; fi; fi',
        'rm -rf "$tmp"',
        'exec /usr/bin/open -a "$app"',
      ].join("\n");
      detached("/bin/sh", ["-c", swap, "sh", pid, into, path.join(out, bundle), tmp]);
    }
    req.quit();
  } catch (e) {
    busy = false;
    bar(-1);
    fs.rmSync(tmp, { recursive: true, force: true });
    if (PLATFORM === "linux-x86_64") fs.rmSync(path.join(path.dirname(into), `.${path.basename(into)}.update`), { force: true });
    await dialog.showMessageBox({ type: "error", message: t("The update couldn't be downloaded: {error}", { error: e instanceof Error ? e.message : String(e) }) });
  }
}

/** What the window was doing, for the start after the update. */
export function saveResume(dir: string, win: BrowserWindow | null) {
  if (!win || win.isDestroyed()) return;
  let where = "/";
  try {
    const u = new URL(win.webContents.getURL());
    if (u.protocol.startsWith("http")) where = u.pathname + u.search + u.hash;
  } catch {
    /* the app's own page */
  }
  fs.writeFileSync(path.join(dir, RESUME), JSON.stringify({ path: where, hidden: !win.isVisible(), at: Date.now() }));
}

/** Once, at the start after an update (ten minutes at most after it): the page it was on, and whether it was hidden. */
export function resumed(dir: string): { path: string; hidden: boolean } | null {
  const file = path.join(dir, RESUME);
  try {
    const r = JSON.parse(fs.readFileSync(file, "utf8")) as { path?: unknown; hidden?: unknown; at?: unknown };
    fs.rmSync(file, { force: true });
    if (typeof r.at !== "number" || Date.now() - r.at > 10 * 60_000 || typeof r.path !== "string" || !r.path.startsWith("/") || r.path.startsWith("//")) return null;
    return { path: r.path, hidden: r.hidden === true };
  } catch {
    return null;
  }
}
