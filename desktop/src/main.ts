import { app, BrowserWindow, ipcMain, Menu, nativeImage, net, Notification, powerMonitor, session, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { loadSite, newer, origin, PLATFORM, Store } from "./site";
import { getLang, setLang, t, texts } from "./text";
import { setupCapture, pickerCall } from "./capture";
import { createWindow, pageMenu } from "./window";
import { Tray as AppTray } from "./tray";
import { Notifier } from "./notify";
import { update, resumed, saveResume } from "./updater";
import { autostart, setAutostart } from "./autostart";
import { appMenu } from "./menu";
import { integrate } from "./linux";

/**
 * Communarr on the computer: the server's site in a window of its own, which stays in the tray when
 * it's closed. Notifications come while it runs (the page passes them on: see notify.ts), the screen is
 * shared through its own picker (capture.ts), and it updates itself when the site's menu says so
 * (updater.ts).
 *
 *   --hidden       start in the tray (as at login)
 *   --check        start, check the parts it's made of, and end (the build's own test)
 *   --report FILE  what --check found, also into FILE (Windows' app has no console)
 */

const VERSION = app.getVersion();
const ASSETS = path.join(__dirname, "..", "assets");
const PAGES = path.join(__dirname, "..", "pages");
const arg = (name: string) => process.argv.includes(name);
const argValue = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const CHECK = arg("--check");

const site = loadSite(process.resourcesPath);
app.setName(site.name);
// (COMMUNARR_DATA: a folder of its own, for trying it from source)
app.setPath("userData", process.env.COMMUNARR_DATA || path.join(app.getPath("appData"), site.name));
if (process.platform === "win32") app.setAppUserModelId(site.id);
// Linux knows the app's windows (and the screen portal knows the app) by its desktop file's name
if (process.platform === "linux") app.setDesktopName(`${site.id}.desktop`);
// the media keys stay the music player's (the page's audio is the call's), as Discord does
app.commandLine.appendSwitch("disable-features", "HardwareMediaKeyHandling,MediaSessionService");

const store = new Store(app.getPath("userData"));
setLang(store.data.lang ?? app.getPreferredSystemLanguages()[0] ?? app.getLocale());
/** where this copy runs from: the AppImage on Linux, else the program */
const EXEC = process.env.APPIMAGE || process.execPath;
if (process.platform === "linux" && process.env.APPIMAGE && !CHECK) integrate(site, EXEC, path.join(ASSETS, "icon.png"));

let win: BrowserWindow | null = null;
let tray: AppTray | null = null;
let quitting = false;
let server: string | null = store.data.server ?? site.server;
const notifier = new Notifier(site, () => showWindow(), (msg) => toPage(msg), ASSETS);

const icon = () => nativeImage.createFromPath(path.join(ASSETS, "icon.png"));

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function toPage(msg: Record<string, unknown>) {
  if (win && !win.isDestroyed()) win.webContents.send("to-page", JSON.stringify(msg));
}

/**
 * Whether its window is in front, for the page: the server sends notifications to the app only while
 * it isn't (a hidden window's page can't tell itself: it's never throttled, so it always seems in sight).
 */
let looking: boolean | null = null;
function tellLooking(always = false) {
  const now = !!win && !win.isDestroyed() && win.isVisible() && !win.isMinimized() && win.isFocused();
  if (always || now !== looking) toPage({ t: "window", looking: now });
  looking = now;
}

function loadLocal(page: "connect" | "offline", query: Record<string, string> = {}) {
  void win?.loadFile(path.join(PAGES, `${page}.html`), { query });
}

/** The server's page at `where` (a path on it), or the address asked for when there's no server yet. */
function goTo(where = "/") {
  if (server) void win?.loadURL(server + (where.startsWith("/") && !where.startsWith("//") ? where : "/"));
  else loadLocal("connect");
}

function quit() {
  quitting = true;
  app.quit();
}

/** Another start of the app: show the window, or hand over to it when it's a newer version. */
function onSecondStart(data: unknown) {
  const d = (data ?? {}) as { version?: string; exec?: string };
  if (typeof d.version === "string" && typeof d.exec === "string" && newer(d.version, VERSION)) {
    console.log(`version ${d.version} started (${d.exec}): handing over to it`);
    app.relaunch({ execPath: d.exec, args: [] });
    quit();
    return;
  }
  showWindow();
}

// ------------------------------------------------------------ the page's messages

/** A message from the server's own page in the window (window.CommunarrApp.postMessage). */
function fromPage(e: Electron.IpcMainEvent, raw: unknown) {
  const frame = e.senderFrame;
  if (!win || e.sender !== win.webContents || !frame || frame !== win.webContents.mainFrame || !server) return;
  if (origin(frame.url) !== server) return;
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(String(raw)) as Record<string, unknown>;
  } catch {
    return;
  }
  switch (m.t) {
    case "update":
      void update({ url: String(m.url ?? ""), version: String(m.version ?? ""), sha256: String(m.sha256 ?? ""), server, site, win, before: () => saveResume(app.getPath("userData"), win), quit });
      break;
    case "window-state":
      tellLooking(true);
      break;
    case "push-status":
    case "push-on":
      toPage({ t: "push-status", desktop: true, supported: Notification.isSupported() });
      break;
    case "notify":
      notifier.show({ title: String(m.title ?? ""), body: String(m.body ?? ""), url: String(m.url ?? "/"), tag: String(m.tag ?? "") });
      break;
    case "badge": {
      const n = Math.max(0, Math.min(9999, Math.floor(Number(m.count) || 0)));
      tray?.setUnread(n);
      notifier.badge(n, win);
      break;
    }
  }
}

// ------------------------------------------------------------ the app's own pages

async function connect(address: string): Promise<{ ok: true } | { error: string }> {
  const o = origin(address);
  if (!address.trim()) return { error: t("Write the server's address.") };
  if (!o) return { error: t("The address must start with https:// (http:// only for this computer).") };
  const shown = o.replace(/^https:\/\//, "");
  try {
    const r = await net.fetch(`${o}/api/health`, { signal: AbortSignal.timeout(10_000) });
    const ok = r.ok && ((await r.json().catch(() => null)) as { ok?: boolean } | null)?.ok === true;
    const m = ok ? await net.fetch(`${o}/manifest.webmanifest`, { signal: AbortSignal.timeout(10_000) }) : null;
    if (!ok || !m?.ok) return { error: t("{address} isn't a Communarr server.", { address: shown }) };
  } catch (e) {
    return { error: t("{address} couldn't be reached: {error}", { address: shown, error: e instanceof Error ? e.message : String(e) }) };
  }
  server = o;
  store.set({ server: o });
  goTo("/");
  return { ok: true };
}

async function localCall(e: Electron.IpcMainInvokeEvent, name: string, ...args: unknown[]): Promise<unknown> {
  if (!e.senderFrame?.url.startsWith("file://")) throw new Error("not the app's own page");
  if (win && e.sender !== win.webContents) return pickerCall(e.sender, name, ...args);
  switch (name) {
    case "texts":
      return texts(Array.isArray(args[0]) ? (args[0] as unknown[]).map(String) : [], { name: site.name });
    case "info":
      return { name: site.name, server: server?.replace(/^https:\/\//, "") ?? site.server?.replace(/^https:\/\//, "") ?? "", connected: !!server, lang: getLang() };
    case "connect":
      return connect(String(args[0] ?? ""));
    case "back":
      goTo("/");
      return null;
    case "change-server":
      loadLocal("connect");
      return null;
    case "reachable":
      if (!server) return false;
      try {
        return (await net.fetch(`${server}/api/health`, { signal: AbortSignal.timeout(8000) })).ok;
      } catch {
        return false;
      }
  }
  throw new Error(`no such call: ${name}`);
}

// ------------------------------------------------------------ the session

function setupSession() {
  const ses = session.defaultSession;
  // "CommunarrDesktop/0.1.0 (Friends; linux-x86_64)": the site knows the app by it (androidApp.ts)
  const ua = `${app.userAgentFallback.replace(/ (Electron|Communarr|communarr-desktop)\/\S+/g, "").replace(` ${site.name}/${VERSION}`, "")} CommunarrDesktop/${VERSION} (${site.name}; ${PLATFORM})`;
  app.userAgentFallback = ua;
  ses.setUserAgent(ua);
  // the microphone, the camera, the screen, notifications: for the server's own pages
  const allowed = new Set(["media", "display-capture", "notifications", "clipboard-sanitized-write", "clipboard-read", "speaker-selection", "pointerLock", "keyboardLock"]);
  const mine = (url: string | undefined) => !!url && !!server && origin(url) === server;
  ses.setPermissionRequestHandler((_wc, permission, callback, details) => callback(permission === "fullscreen" || (allowed.has(permission) && mine(details.requestingUrl))));
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) => permission === "fullscreen" || (allowed.has(permission) && mine(requestingOrigin)));
  setupCapture(ses, () => win, () => server);
  if (process.platform !== "darwin") {
    const want = ["sv", "en-US"].filter((l) => ses.availableSpellCheckerLanguages.includes(l));
    if (want.length) ses.setSpellCheckerLanguages(want);
  }
}

// ------------------------------------------------------------ starting

function start() {
  setupSession();
  Menu.setApplicationMenu(process.platform === "darwin" ? appMenu(site.name) : null);
  const back = resumed(app.getPath("userData"));
  const hidden = back ? back.hidden : arg("--hidden") || (process.platform === "darwin" && app.getLoginItemSettings().wasOpenedAtLogin);
  win = createWindow({
    site,
    store,
    preload: path.join(__dirname, "preload.js"),
    icon: icon(),
    hidden,
    server: () => server,
    quitting: () => quitting,
    onClose: () => {
      if (!store.data.toldTray && tray?.shown) {
        store.set({ toldTray: true });
        notifier.say(t(process.platform === "darwin" ? "{name} is still running in the menu bar. Quit it from there." : "{name} is still running in the tray. Quit it from the tray's menu.", { name: site.name }));
      }
    },
    offline: (error) => loadLocal("offline", { error }),
    onLoad: async (w) => {
      // the site's language for the app's own words
      const lang = (await w.webContents.executeJavaScript("document.documentElement.lang").catch(() => "")) as string;
      if (lang && setLang(lang)) tray?.refresh();
      if (lang && lang !== store.data.lang) store.set({ lang });
      toPage({ t: "idle", idle: idle.now });
      tellLooking(true);
    },
    menu: pageMenu,
  });
  for (const ev of ["show", "hide", "focus", "blur", "minimize", "restore"] as const) win.on(ev as "show", () => setTimeout(() => tellLooking(), 0));
  tray = new AppTray({
    name: site.name,
    assets: ASSETS,
    show: showWindow,
    changeServer: () => {
      showWindow();
      loadLocal("connect");
    },
    autostart: () => autostart(site),
    setAutostart: (on) => setAutostart(site, on, EXEC),
    quit,
  });
  // (the AppImage may have moved since login was told where it is)
  if (process.platform === "linux" && autostart(site)) setAutostart(site, true, EXEC);
  goTo(back?.path ?? "/");
  idle.start();
}

/** Away from the computer (3 minutes without input, or locked): the server sends pushes to the phone instead. */
const idle = {
  now: false,
  timer: undefined as NodeJS.Timeout | undefined,
  check() {
    const s = powerMonitor.getSystemIdleState(180);
    const away = s === "idle" || s === "locked";
    if (away !== idle.now) {
      idle.now = away;
      toPage({ t: "idle", idle: away });
    }
  },
  start() {
    idle.timer = setInterval(() => idle.check(), 15_000);
    powerMonitor.on("lock-screen", () => idle.check());
    powerMonitor.on("unlock-screen", () => idle.check());
    powerMonitor.on("resume", () => idle.check());
  },
};

/** The build's own test: the app's parts are there and its pages talk to it. */
async function check() {
  const lines: string[] = [];
  const say = (s: string) => {
    lines.push(s);
    console.log(s);
  };
  let ok = true;
  try {
    say(`${site.name} ${VERSION} (${PLATFORM}), Electron ${process.versions.electron}`);
    for (const f of ["icon.png", "tray.png", "tray-unread.png", "trayTemplate.png", "overlay-unread.png"]) {
      if (nativeImage.createFromPath(path.join(ASSETS, f)).isEmpty()) throw new Error(`${f} is missing`);
    }
    const w = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true } });
    win = w;
    await w.loadFile(path.join(PAGES, "connect.html"));
    const word = (await w.webContents.executeJavaScript("window.desktop.call('texts', ['Connect']).then((x) => x.Connect)")) as string;
    if (!word) throw new Error("the page's bridge doesn't answer");
    say(`the connect page and its bridge: ok (${word})`);
    w.destroy();
  } catch (e) {
    ok = false;
    say(`FAILED: ${e instanceof Error ? e.message : e}`);
  }
  const report = argValue("--report");
  if (report) fs.writeFileSync(report, lines.join("\n") + "\n");
  app.exit(ok ? 0 : 1);
}

ipcMain.on("from-page", fromPage);
ipcMain.handle("local", localCall);

if (CHECK) {
  void app.whenReady().then(check);
} else if (!app.requestSingleInstanceLock({ version: VERSION, exec: EXEC })) {
  app.exit(0);
} else {
  app.on("second-instance", (_e, _argv, _cwd, data) => onSecondStart(data));
  app.on("before-quit", () => {
    quitting = true;
  });
  app.on("activate", () => showWindow());
  app.on("window-all-closed", () => {
    /* it stays in the tray */
  });
  // nothing else opens windows or embeds pages; links elsewhere go to the browser (window.ts)
  app.on("web-contents-created", (_e, wc) => {
    wc.on("will-attach-webview", (ev) => ev.preventDefault());
    wc.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
      return { action: "deny" };
    });
  });
  void app.whenReady().then(start);
}
