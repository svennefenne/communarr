// electron-builder as the desktop app is built with it (scripts/build.mjs, scripts/site-copy.mjs): its
// AppImage's desktop file without X-AppImage-Version, which AppImageLauncher puts in the app's name in
// the menus ("Communarr (0.1.0)"); the configuration has no way to leave it out.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
export const here = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const lib = (p) => path.join(here, "node_modules", ...p.split("/"));

export function builder() {
  const { LinuxTargetHelper } = require(lib("app-builder-lib/out/targets/LinuxTargetHelper.js"));
  const compute = LinuxTargetHelper.prototype.computeDesktopEntry;
  if (!compute.patched) {
    LinuxTargetHelper.prototype.computeDesktopEntry = function (options, exec, extra) {
      const { "X-AppImage-Version": _version, ...rest } = extra ?? {};
      return compute.call(this, options, exec, rest);
    };
    LinuxTargetHelper.prototype.computeDesktopEntry.patched = true;
  }
  return require(lib("electron-builder"));
}
