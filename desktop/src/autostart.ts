import { app } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { slug, type Site } from "./site";

/**
 * Starting at login, in the tray (--hidden). Windows and macOS keep it themselves; on Linux it's a
 * desktop file in ~/.config/autostart, pointing at the AppImage where it is.
 */
const linuxFile = (site: Site) => path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "autostart", `${slug(site.name)}-desktop.desktop`);

export function autostart(site: Site): boolean {
  if (process.platform === "linux") return fs.existsSync(linuxFile(site));
  return app.getLoginItemSettings({ args: ["--hidden"] }).openAtLogin;
}

export function setAutostart(site: Site, on: boolean, exec: string) {
  if (process.platform !== "linux") {
    // (a Mac opens it with no arguments: main.ts sees it was opened at login)
    app.setLoginItemSettings({ openAtLogin: on, args: ["--hidden"] });
    return;
  }
  const file = linuxFile(site);
  if (!on) {
    fs.rmSync(file, { force: true });
    return;
  }
  // run from source: Electron with the app's folder
  const cmd = app.isPackaged ? [exec] : [process.execPath, app.getAppPath()];
  const quote = (s: string) => `"${s.replace(/(["`$\\])/g, "\\$1")}"`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    ["[Desktop Entry]", "Type=Application", `Name=${site.name}`, `Exec=${[...cmd.map(quote), "--hidden"].join(" ")}`, "Terminal=false", "X-GNOME-Autostart-enabled=true", ""].join("\n"),
  );
}
