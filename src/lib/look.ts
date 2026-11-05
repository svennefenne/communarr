import type { ThemePrefs } from "./types";

/**
 * How the site looks on a screen (light or dark, the colour scheme or an own theme, text size,
 * compact) is each device's own: a phone and a computer can look different. It's kept in a cookie
 * per member, so the server draws the page that way from the start (no flash). The account keeps
 * the latest choice, which is what a new device starts with; a device that has no cookie yet gets
 * one with the look it has now (keepLook), so a change on another device doesn't reach it.
 */
export type Look = Pick<ThemePrefs, "scheme" | "mode" | "custom" | "density" | "textSize">;

export const LOOK_DAYS = 400;
export const lookCookie = (userId: number) => `hd_look_${userId}`;

/** "1.nord.dark.0.c.110": scheme, mode, own theme (0: none), compact (c) or not (n), text size */
export function encodeLook(p: Look): string {
  return ["1", p.scheme, p.mode, p.custom ?? 0, p.density === "compact" ? "c" : "n", p.textSize].join(".");
}

/** What a look cookie says (anything odd in it is left out). */
export function decodeLook(raw: string | undefined): Partial<Look> {
  const [v, scheme, mode, custom, density, size] = (raw || "").split(".");
  if (v !== "1") return {};
  const out: Partial<Look> = {};
  if (/^[a-z0-9-]{1,40}$/.test(scheme ?? "")) out.scheme = scheme;
  if (mode === "dark" || mode === "light" || mode === "system") out.mode = mode;
  if (/^\d{1,9}$/.test(custom ?? "")) out.custom = Number(custom) || null;
  if (density === "c" || density === "n") out.density = density === "c" ? "compact" : "comfy";
  if (/^\d{2,3}$/.test(size ?? "")) out.textSize = Math.max(85, Math.min(130, Number(size)));
  return out;
}

/** In the browser: keep this device's look (another LOOK_DAYS), or start keeping it, as it is now. */
export function keepLook(userId: number, p: Look) {
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${lookCookie(userId)}=${encodeLook(p)}; path=/; max-age=${LOOK_DAYS * 86_400}; samesite=lax${secure}`;
}
