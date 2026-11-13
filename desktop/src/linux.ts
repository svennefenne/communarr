import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Site } from "./site";

/**
 * Linux: the AppImage puts itself in the desktop's menus (a desktop file named by the app's id, and its
 * icon), and keeps them pointing at wherever the file is now. The desktop knows the app's windows by
 * that id (their icon and name in the taskbar), and its desktop portal shares the screen only for an id
 * it finds a desktop file for (xdg-desktop-portal 1.21 and later).
 *
 * AppImageLauncher leaves it be (its desktop file says X-AppImage-Integrate=false): an entry of its own
 * as well would be the app twice in the menus, and named "Hooden (1)" beside this one. One it made
 * before (an older version's) is taken away, with its icons.
 */
export function integrate(site: Site, appimage: string, icon: string) {
  const data = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  const apps = path.join(data, "applications");
  const icons = path.join(data, "icons", "hicolor");
  const file = path.join(apps, `${site.id}.desktop`);
  const iconFile = path.join(icons, "512x512", "apps", `${site.id}.png`);
  try {
    // AppImageLauncher's entries for this file (appimagekit_<id>-Name.desktop), and their icons
    for (const f of fs.existsSync(apps) ? fs.readdirSync(apps) : []) {
      const m = f.match(/^appimagekit_([0-9a-f]+)-.*\.desktop$/);
      if (!m) continue;
      const text = fs.readFileSync(path.join(apps, f), "utf8");
      const exec = /^Exec=(.*)$/m.exec(text)?.[1] ?? "";
      if (![appimage, `"${appimage}"`].some((a) => exec === a || exec.startsWith(`${a} `))) continue;
      fs.rmSync(path.join(apps, f), { force: true });
      for (const size of fs.existsSync(icons) ? fs.readdirSync(icons) : []) {
        const dir = path.join(icons, size, "apps");
        for (const i of fs.existsSync(dir) ? fs.readdirSync(dir) : []) if (i.startsWith(`appimagekit_${m[1]}_`)) fs.rmSync(path.join(dir, i), { force: true });
      }
    }
    const quote = (s: string) => `"${s.replace(/(["`$\\])/g, "\\$1")}"`;
    const entry = [
      "[Desktop Entry]",
      "Type=Application",
      `Name=${site.name}`,
      `Exec=${quote(appimage)} %U`,
      `Icon=${site.id}`,
      `StartupWMClass=${site.id}`,
      "Categories=Network;InstantMessaging;Chat;",
      "Terminal=false",
      "",
    ].join("\n");
    if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== entry) {
      fs.mkdirSync(apps, { recursive: true });
      fs.writeFileSync(file, entry);
    }
    const png = fs.readFileSync(icon);
    if (!fs.existsSync(iconFile) || !fs.readFileSync(iconFile).equals(png)) {
      fs.mkdirSync(path.dirname(iconFile), { recursive: true });
      fs.writeFileSync(iconFile, png);
    }
  } catch (e) {
    console.error("couldn't put the app in the menus:", e);
  }
}
