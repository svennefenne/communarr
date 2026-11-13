import { app, nativeImage, Notification, type BrowserWindow } from "electron";
import path from "node:path";
import type { Site } from "./site";
import { t } from "./text";

/**
 * The computer's notifications. A browser gets the site's through Web Push, which the app hasn't got:
 * the server sends them to the app's page instead (a "push" on its live connection), and the page
 * passes them here. One with the same tag as an earlier one (a chat room's) takes its place.
 */
export class Notifier {
  private shown = new Map<string, Notification>();
  private overlay: Electron.NativeImage;
  private icon: string;
  constructor(
    private site: Site,
    private open: () => void,
    private toPage: (msg: Record<string, unknown>) => void,
    assets: string,
  ) {
    this.icon = path.join(assets, "icon.png");
    this.overlay = nativeImage.createFromPath(path.join(assets, "overlay-unread.png"));
  }

  notify({ title, body, onClick, tag }: { title: string; body: string; onClick: () => void; tag?: string }) {
    if (!Notification.isSupported()) return;
    const n = new Notification({ title: title.slice(0, 200), body: body.slice(0, 1000), icon: process.platform === "darwin" ? undefined : this.icon });
    n.on("click", onClick);
    if (tag) {
      this.shown.get(tag)?.close();
      this.shown.set(tag, n);
      n.on("close", () => this.shown.get(tag) === n && this.shown.delete(tag));
    }
    n.show();
  }

  /** One from the site: clicked, the window opens at its page. */
  show({ title, body, url, tag }: { title: string; body: string; url: string; tag: string }) {
    if (!title) return;
    this.notify({
      title,
      body,
      tag: tag.slice(0, 80),
      onClick: () => {
        this.open();
        if (url.startsWith("/") && !url.startsWith("//")) this.toPage({ t: "open", url });
      },
    });
  }

  /** The app's own word ("still running in the tray"). */
  say(body: string) {
    this.notify({ title: this.site.name, body, onClick: this.open });
  }

  /** How much is unread: the Dock's and Linux launchers' count, Windows' taskbar dot. */
  badge(n: number, win: BrowserWindow | null) {
    app.setBadgeCount(n);
    if (process.platform === "win32" && win && !win.isDestroyed()) win.setOverlayIcon(n ? this.overlay : null, n ? t("{n} unread", { n }) : "");
  }
}
