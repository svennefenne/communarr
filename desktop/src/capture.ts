import { BrowserWindow, desktopCapturer, type Session, type WebContents } from "electron";
import path from "node:path";
import { origin } from "./site";
import { t, texts } from "./text";

/**
 * Sharing the screen (the site's Go live): the page asks with getDisplayMedia, and the app asks which
 * screen or window. Its own picker on Windows (where the computer's sound can go along) and on X11;
 * Wayland's own (the desktop portal) on Linux there; macOS 15's own on a Mac. No "is sharing" bar.
 */

interface Source {
  id: string;
  name: string;
  kind: "screen" | "window";
  thumb: string;
  icon: string | null;
}

interface Picking {
  win: BrowserWindow;
  audio: boolean;
  sources: Map<string, Electron.DesktopCapturerSource>;
  done: (choice: { id: string; name: string; audio: boolean } | null) => void;
}

const picking = new Map<number, Picking>();
const wayland = () => process.platform === "linux" && (process.env.XDG_SESSION_TYPE === "wayland" || !!process.env.WAYLAND_DISPLAY);

async function sources(): Promise<Electron.DesktopCapturerSource[]> {
  const ours = new Set(BrowserWindow.getAllWindows().map((w) => w.getMediaSourceId()));
  const all = await desktopCapturer.getSources({ types: ["screen", "window"], thumbnailSize: { width: 320, height: 200 }, fetchWindowIcons: true });
  return all.filter((s) => !ours.has(s.id));
}

function describe(list: Electron.DesktopCapturerSource[]): Source[] {
  let n = 0;
  const screens = list.filter((s) => s.id.startsWith("screen:")).length;
  return list.map((s) => {
    const kind = s.id.startsWith("screen:") ? "screen" : "window";
    if (kind === "screen") n++;
    return {
      id: s.id,
      name: kind === "screen" ? (screens > 1 ? t("Screen {n}", { n }) : t("Entire screen")) : s.name,
      kind,
      thumb: s.thumbnail.isEmpty() ? "" : s.thumbnail.toDataURL(),
      icon: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : null,
    };
  });
}

/** The picker's calls (picker.html). */
export async function pickerCall(sender: WebContents, name: string, ...args: unknown[]): Promise<unknown> {
  const p = picking.get(sender.id);
  if (!p) throw new Error("not a picker");
  switch (name) {
    case "texts":
      return texts(Array.isArray(args[0]) ? (args[0] as unknown[]).map(String) : []);
    case "sources": {
      const list = await sources();
      p.sources = new Map(list.map((s) => [s.id, s]));
      return { sources: describe(list), audio: p.audio };
    }
    case "choose": {
      const id = typeof args[0] === "string" ? args[0] : null;
      const s = id ? p.sources.get(id) : undefined;
      p.done(s ? { id: s.id, name: s.name, audio: p.audio && args[1] === true } : null);
      return null;
    }
  }
  throw new Error(`no such call: ${name}`);
}

function pick(parent: BrowserWindow | null, audio: boolean): Promise<{ id: string; name: string; audio: boolean } | null> {
  return new Promise((resolve) => {
    const w = new BrowserWindow({
      parent: parent ?? undefined,
      modal: !!parent,
      width: 760,
      height: 600,
      minWidth: 420,
      minHeight: 360,
      show: false,
      title: t("Share your screen"),
      backgroundColor: "#070b10",
      autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true },
    });
    let settled = false;
    const done = (choice: { id: string; name: string; audio: boolean } | null) => {
      if (settled) return;
      settled = true;
      picking.delete(id);
      resolve(choice);
      if (!w.isDestroyed()) w.close();
    };
    const id = w.webContents.id;
    picking.set(id, { win: w, audio, sources: new Map(), done });
    w.on("closed", () => done(null));
    w.once("ready-to-show", () => w.show());
    void w.loadFile(path.join(__dirname, "..", "pages", "picker.html"));
  });
}

export function setupCapture(ses: Session, win: () => BrowserWindow | null, server: () => string | null) {
  ses.setDisplayMediaRequestHandler(
    (request, callback) => {
      const s = server();
      if (!s || origin(request.securityOrigin) !== s) return callback({});
      void (async () => {
        try {
          if (wayland()) {
            // the portal has already asked which screen or window
            const [chosen] = await desktopCapturer.getSources({ types: ["screen", "window"], thumbnailSize: { width: 0, height: 0 } });
            return callback(chosen ? { video: chosen } : {});
          }
          const choice = await pick(win(), request.audioRequested && process.platform === "win32");
          if (!choice) return callback({});
          callback({ video: { id: choice.id, name: choice.name }, ...(choice.audio ? { audio: "loopback" as const } : {}) });
        } catch (e) {
          console.error("sharing the screen:", e);
          callback({});
        }
      })();
    },
    { useSystemPicker: true },
  );
}
