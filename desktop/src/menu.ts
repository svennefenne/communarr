import { Menu } from "electron";
import { t } from "./text";

/** A Mac's menu bar (the clipboard's keys go through it); Windows and Linux have none (window.ts). */
export function appMenu(name: string): Menu {
  return Menu.buildFromTemplate([
    {
      label: name,
      submenu: [
        { label: t("About {name}", { name }), role: "about" },
        { type: "separator" },
        { label: t("Hide {name}", { name }), role: "hide" },
        { label: t("Hide others"), role: "hideOthers" },
        { label: t("Show all"), role: "unhide" },
        { type: "separator" },
        { label: t("Quit {name}", { name }), role: "quit" },
      ],
    },
    {
      label: t("Edit"),
      submenu: [
        { label: t("Undo"), role: "undo" },
        { label: t("Redo"), role: "redo" },
        { type: "separator" },
        { label: t("Cut"), role: "cut" },
        { label: t("Copy"), role: "copy" },
        { label: t("Paste"), role: "paste" },
        { label: t("Select all"), role: "selectAll" },
      ],
    },
    {
      label: t("View"),
      submenu: [
        { label: t("Reload"), role: "reload" },
        { label: t("Actual size"), role: "resetZoom" },
        { label: t("Zoom in"), role: "zoomIn" },
        { label: t("Zoom out"), role: "zoomOut" },
        { type: "separator" },
        { label: t("Full screen"), role: "togglefullscreen" },
        { label: t("Developer tools"), role: "toggleDevTools" },
      ],
    },
    {
      label: t("Window"),
      submenu: [
        { label: t("Minimize"), role: "minimize" },
        { label: t("Close"), role: "close" },
      ],
    },
  ]);
}
