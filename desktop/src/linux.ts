import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Site } from "./site";

/**
 * Linux: the AppImage puts itself in the desktop's menus (a desktop file named by the app's id, and its
 * icon), and keeps them pointing at wherever the file is now. The desktop needs it to know the app's
 * windows by their id (their icon in the taskbar) and its desktop portal to share the screen
 * (xdg-desktop-portal 1.21 and later turn away an id it can't find a desktop file for). Where
 * AppImageLauncher already put it in the menus, the file stays out of them, so it isn't there twice.
 */
export function integrate(site: Site, appimage: string, icon: string) {
  const data = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  const apps = path.join(data, "applications");
  const file = path.join(apps, `${site.id}.desktop`);
  const iconFile = path.join(data, "icons", "hicolor", "512x512", "apps", `${site.id}.png`);
  try {
    let launcher = false;
    for (const f of fs.existsSync(apps) ? fs.readdirSync(apps) : []) {
      if (f === path.basename(file) || !f.endsWith(".desktop")) continue;
      const text = fs.readFileSync(path.join(apps, f), "utf8");
      if (/^Exec=.*/m.exec(text)?.[0].includes(appimage)) launcher = true;
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
      ...(launcher ? ["NoDisplay=true"] : []),
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
