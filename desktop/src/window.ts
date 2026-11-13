import { BrowserWindow, clipboard, Menu, screen, shell, type MenuItemConstructorOptions, type NativeImage } from "electron";
import { origin, type Site, type Store } from "./site";
import { t } from "./text";

interface Options {
  site: Site;
  store: Store;
  preload: string;
  icon: NativeImage;
  hidden: boolean;
  server: () => string | null;
  quitting: () => boolean;
  /** closed with the window's X: it goes to the tray */
  onClose: () => void;
  /** the server couldn't be reached (or answered with a gateway's error) */
  offline: (error: string) => void;
  /** a page of the server's has loaded */
  onLoad: (w: BrowserWindow) => void;
  menu: (w: BrowserWindow, p: Electron.ContextMenuParams) => Menu | null;
}

/** Where the window was, if that's still on a screen; else its first size, in the middle. */
function placed(bounds: Options["store"]["data"]["bounds"]) {
  if (!bounds) return { width: 1280, height: 860 };
  const seen = screen.getAllDisplays().some(({ workArea: a }) => bounds.x < a.x + a.width - 80 && bounds.x + bounds.width > a.x + 80 && bounds.y >= a.y - 20 && bounds.y < a.y + a.height - 80);
  return seen ? bounds : { width: bounds.width, height: bounds.height };
}

/**
 * The app's window: the server's site, as in a browser, but only the server's. Links elsewhere open in
 * the browser; a page that won't load gives the app's own page that tries again. It keeps running
 * hidden (in a call, the voices and the microphone go on), and its X puts it in the tray.
 */
export function createWindow(o: Options): BrowserWindow {
  const w = new BrowserWindow({
    ...placed(o.store.data.bounds),
    minWidth: 360,
    minHeight: 480,
    show: false,
    title: o.site.name,
    icon: process.platform === "darwin" ? undefined : o.icon,
    backgroundColor: "#070b10",
    autoHideMenuBar: true,
    webPreferences: {
      preload: o.preload,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
      // a hidden window still talks, listens and shows notifications
      backgroundThrottling: false,
      autoplayPolicy: "no-user-gesture-required",
    },
  });
  if (o.store.data.maximized) w.maximize();
  w.once("ready-to-show", () => {
    if (!o.hidden) w.show();
  });

  // where it is, for the next start
  let saving: NodeJS.Timeout | undefined;
  const save = () => {
    clearTimeout(saving);
    saving = setTimeout(() => {
      if (w.isDestroyed()) return;
      if (w.isMaximized() || w.isFullScreen()) o.store.set({ maximized: w.isMaximized() });
      else if (!w.isMinimized() && w.isVisible()) o.store.set({ bounds: w.getBounds(), maximized: false });
    }, 500);
  };
  for (const ev of ["resize", "move", "maximize", "unmaximize"] as const) w.on(ev as "resize", save);

  w.on("close", (e) => {
    if (o.quitting()) return;
    e.preventDefault();
    if (w.isFullScreen()) {
      w.once("leave-full-screen", () => w.hide());
      w.setFullScreen(false);
    } else w.hide();
    o.onClose();
  });

  // only the server's pages in the window; the rest in the browser
  const isServer = (url: string) => {
    const s = o.server();
    return !!s && origin(url) === s;
  };
  w.webContents.on("will-navigate", (e, url) => {
    if (url.startsWith("file://") || isServer(url)) return;
    e.preventDefault();
    if (/^(https?|mailto):/i.test(url)) void shell.openExternal(url);
  });
  w.webContents.on("will-redirect", (e, url, _inPlace, isMainFrame) => {
    if (isMainFrame && !isServer(url)) {
      e.preventDefault();
      if (/^https?:/i.test(url)) void shell.openExternal(url);
    }
  });

  // can't be reached: the app's page that tries again (not for a load given up on, -3)
  w.webContents.on("did-fail-load", (_e, code, description, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && isServer(url)) o.offline(description || String(code));
  });
  w.webContents.on("did-navigate", (_e, url, status) => {
    if (isServer(url) && status >= 502 && status <= 504) o.offline(`HTTP ${status}`);
  });
  w.webContents.on("did-finish-load", () => {
    if (isServer(w.webContents.getURL())) o.onLoad(w);
  });
  w.webContents.on("render-process-gone", (_e, d) => {
    if (d.reason !== "clean-exit") setTimeout(() => !w.isDestroyed() && w.webContents.reload(), 1000);
  });

  w.webContents.on("context-menu", (_e, p) => o.menu(w, p)?.popup({ window: w }));

  // Windows and Linux have no menu bar: zoom, reload and the developer tools by their keys
  if (process.platform !== "darwin") {
    w.webContents.on("before-input-event", (e, i) => {
      if (i.type !== "keyDown") return;
      const mod = i.control || i.meta;
      const wc = w.webContents;
      if (mod && (i.key === "+" || i.key === "=")) wc.setZoomLevel(Math.min(wc.getZoomLevel() + 0.5, 4));
      else if (mod && i.key === "-") wc.setZoomLevel(Math.max(wc.getZoomLevel() - 0.5, -3));
      else if (mod && i.key === "0") wc.setZoomLevel(0);
      else if (i.key === "F5" || (mod && !i.shift && i.key.toLowerCase() === "r")) wc.reload();
      else if (i.key === "F12" || (mod && i.shift && i.key.toLowerCase() === "i")) wc.toggleDevTools();
      else if (i.key === "F11") w.setFullScreen(!w.isFullScreen());
      else return;
      e.preventDefault();
    });
  }
  return w;
}

/** The right-click menu: spelling, editing, links and images. */
export function pageMenu(w: BrowserWindow, p: Electron.ContextMenuParams): Menu | null {
  const wc = w.webContents;
  const items: MenuItemConstructorOptions[] = [];
  const sep = () => items.length && items[items.length - 1].type !== "separator" && items.push({ type: "separator" });
  if (p.misspelledWord) {
    for (const s of p.dictionarySuggestions.slice(0, 5)) items.push({ label: s, click: () => wc.replaceMisspelling(s) });
    items.push({ label: t("Add to the dictionary"), click: () => wc.session.addWordToSpellCheckerDictionary(p.misspelledWord) });
    sep();
  }
  if (p.linkURL && /^(https?|mailto):/i.test(p.linkURL)) {
    items.push({ label: t("Open the link in the browser"), click: () => void shell.openExternal(p.linkURL) });
    items.push({ label: t("Copy the link's address"), click: () => clipboard.writeText(p.linkURL) });
    sep();
  }
  if (p.mediaType === "image" && p.srcURL) {
    items.push({ label: t("Copy the image"), click: () => wc.copyImageAt(p.x, p.y) });
    items.push({ label: t("Save the image as…"), click: () => wc.downloadURL(p.srcURL) });
    items.push({ label: t("Copy the image's address"), click: () => clipboard.writeText(p.srcURL) });
    sep();
  }
  if (p.isEditable) {
    items.push(
      { label: t("Undo"), role: "undo", enabled: p.editFlags.canUndo },
      { label: t("Redo"), role: "redo", enabled: p.editFlags.canRedo },
      { type: "separator" },
      { label: t("Cut"), role: "cut", enabled: p.editFlags.canCut },
      { label: t("Copy"), role: "copy", enabled: p.editFlags.canCopy },
      { label: t("Paste"), role: "paste", enabled: p.editFlags.canPaste },
      { label: t("Select all"), role: "selectAll" },
    );
  } else if (p.selectionText.trim()) {
    items.push({ label: t("Copy"), role: "copy" });
  }
  while (items.length && items[items.length - 1].type === "separator") items.pop();
  return items.length ? Menu.buildFromTemplate(items) : null;
}
