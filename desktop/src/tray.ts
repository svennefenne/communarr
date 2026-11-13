import { Menu, nativeImage, Tray as ElectronTray } from "electron";
import path from "node:path";
import { t } from "./text";

interface Options {
  name: string;
  assets: string;
  show: () => void;
  changeServer: () => void;
  autostart: () => boolean;
  setAutostart: (on: boolean) => void;
  quit: () => void;
}

/**
 * The app in the tray (a Mac's menu bar): its icon, with a dot while something is unread, and its menu.
 * A click opens the window.
 */
export class Tray {
  private tray: ElectronTray | null = null;
  private unread = 0;
  constructor(private o: Options) {
    try {
      this.tray = new ElectronTray(this.image());
      this.tray.on("click", () => o.show());
      this.refresh();
    } catch (e) {
      console.error("no tray here:", e);
    }
  }

  /** whether there's a tray icon to go back to (Linux needs a tray in the panel) */
  get shown() {
    return !!this.tray;
  }

  private image() {
    const mac = process.platform === "darwin";
    const name = this.unread ? (mac ? "trayUnreadTemplate.png" : "tray-unread.png") : mac ? "trayTemplate.png" : "tray.png";
    const img = nativeImage.createFromPath(path.join(this.o.assets, name));
    if (mac) img.setTemplateImage(true);
    return img;
  }

  setUnread(n: number) {
    const was = !!this.unread;
    this.unread = n;
    if (!this.tray) return;
    if (was !== !!n) this.tray.setImage(this.image());
    this.tray.setToolTip(n ? `${this.o.name} (${t("{n} unread", { n })})` : this.o.name);
  }

  /** The menu again (the language changed, or start at login did) */
  refresh() {
    if (!this.tray) return;
    const o = this.o;
    this.tray.setToolTip(this.unread ? `${o.name} (${t("{n} unread", { n: this.unread })})` : o.name);
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: t("Open {name}", { name: o.name }), click: o.show },
        { type: "separator" },
        {
          label: t("Start when I log in"),
          type: "checkbox",
          checked: o.autostart(),
          click: (item) => {
            o.setAutostart(item.checked);
            this.refresh();
          },
        },
        { label: t("Change server…"), click: o.changeServer },
        { type: "separator" },
        { label: t("Quit {name}", { name: o.name }), click: o.quit },
      ]),
    );
  }
}
