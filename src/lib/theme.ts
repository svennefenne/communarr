/**
 * Themes: a colour scheme (one of the 98 palettes, light, dark or following the device) or a
 * member's own theme (their colours, fonts, corners, glass, frame, backdrop and background pictures).
 * themeCss() turns the result into the stylesheet the page is drawn with; the server puts it in
 * <head> (no flash on load) and the theme editor runs it in the browser for its live preview.
 */

import { cssVars, isHex, palette, varsToCss, COLOR_KEYS, type Colors } from "./palettes";
import { displayFont, uiFont } from "./fontChoices";

export type BuiltInBackdrop = "orbits" | "stars" | "grid" | "waves" | "plain";
/** A built-in scene, or "pic:<id>": a picture from the site's library (Admin → Colours & background). */
export type Backdrop = BuiltInBackdrop | `pic:${string}`;

/** A backdrop an admin uploaded: a picture for computers and tablets, and maybe one for phones. */
export interface LibraryBackdrop {
  id: string;
  name: string;
  desktop: string;
  mobile: string;
}

export const isBackdrop = (x: unknown): x is Backdrop => typeof x === "string" && (BACKDROPS.some((b) => b.id === x) || /^pic:[a-z0-9]{4,24}$/.test(x));

/** The library picture a backdrop points at, if it's one (and still there). */
const libraryPic = (b: Backdrop, lib: LibraryBackdrop[]) => (b.startsWith("pic:") ? lib.find((x) => `pic:${x.id}` === b) : undefined);
/** What the page draws behind a library picture: the plain backdrop (or the stars, if it was deleted). */
const drawn = (b: Backdrop, lib: LibraryBackdrop[]): Backdrop => (!b.startsWith("pic:") ? b : libraryPic(b, lib) ? "plain" : "orbits");

export const BACKDROPS: { id: BuiltInBackdrop; label: string }[] = [
  { id: "orbits", label: "Orbits and stars" },
  { id: "stars", label: "Star field" },
  { id: "grid", label: "Retro grid" },
  { id: "waves", label: "Dunes" },
  { id: "plain", label: "Plain" },
];

export interface ThemeBackground {
  desktop: string;
  mobile: string;
  /** 0..90: the theme's background colour laid over the picture, so text stays readable */
  dim: number;
  /** 0..20 px */
  blur: number;
  size: "cover" | "contain" | "tile";
}

/** A member's own theme (themes.data_json). */
export interface ThemeData {
  base: string;
  dark: Colors;
  light: Colors;
  /** which versions the theme has */
  modes: "both" | "dark" | "light";
  display: string;
  ui: string;
  radius: number;
  glass: number;
  frame: boolean;
  backdrop: Backdrop;
  grain: boolean;
  background: ThemeBackground;
}

export interface SiteLook {
  scheme: string;
  mode: "dark" | "light" | "system";
  frame: boolean;
  glass: number;
  backdrop: Backdrop;
  background: { desktop: string; mobile: string; dim: number; blur: number };
  /** the uploaded backdrops anyone can pick */
  backdrops: LibraryBackdrop[];
}

/** Everything themeCss needs. */
export interface ResolvedTheme {
  dark: Colors;
  light: Colors;
  mode: "dark" | "light" | "system";
  display: string;
  ui: string;
  radius: number;
  glass: number;
  frame: boolean;
  backdrop: Backdrop;
  grain: boolean;
  background: ThemeBackground;
  textSize: number;
}

export function themeFromScheme(slug: string): ThemeData {
  const p = palette(slug);
  return {
    base: p.slug,
    dark: { ...p.dark },
    light: { ...p.light },
    modes: "both",
    display: "saira",
    ui: "saira",
    radius: 14,
    glass: 72,
    frame: true,
    backdrop: "orbits",
    grain: true,
    background: { desktop: "", mobile: "", dim: 35, blur: 0, size: "cover" },
  };
}

const clamp = (n: unknown, lo: number, hi: number, d: number) => {
  const x = Number(n);
  return Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.round(x))) : d;
};
const safeUrl = (u: unknown) => (typeof u === "string" && /^\/media\/[\w./-]+$/.test(u) ? u : "");

function cleanColors(c: unknown, fallback: Colors): Colors {
  const out: Colors = { ...fallback };
  if (c && typeof c === "object") {
    for (const k of COLOR_KEYS) {
      const v = (c as Record<string, unknown>)[k];
      if (isHex(v)) (out as unknown as Record<string, string>)[k] = v.toLowerCase();
    }
  }
  delete out.stripes;
  return out;
}

/** Validate a theme from a form or the database: anything odd falls back to the base scheme. */
export function cleanTheme(input: unknown): ThemeData {
  const i = (input && typeof input === "object" ? input : {}) as Partial<ThemeData>;
  const base = themeFromScheme(typeof i.base === "string" ? i.base : "hooden");
  const bg = (i.background || {}) as Partial<ThemeBackground>;
  return {
    base: base.base,
    dark: cleanColors(i.dark, base.dark),
    light: cleanColors(i.light, base.light),
    modes: i.modes === "dark" || i.modes === "light" ? i.modes : "both",
    display: displayFont(String(i.display || "")).id,
    ui: uiFont(String(i.ui || "")).id,
    radius: clamp(i.radius, 0, 28, 14),
    glass: clamp(i.glass, 0, 100, 72),
    frame: i.frame !== false,
    backdrop: isBackdrop(i.backdrop) ? i.backdrop : "orbits",
    grain: i.grain !== false,
    background: {
      desktop: safeUrl(bg.desktop),
      mobile: safeUrl(bg.mobile),
      dim: clamp(bg.dim, 0, 90, 35),
      blur: clamp(bg.blur, 0, 20, 0),
      size: bg.size === "contain" || bg.size === "tile" ? bg.size : "cover",
    },
  };
}

/** The site's look for a member's preferences (and their own theme, if they use one). */
export function resolveTheme(site: SiteLook, prefs: { scheme: string; mode: "dark" | "light" | "system"; textSize?: number } | null, custom: ThemeData | null): ResolvedTheme {
  const textSize = clamp(prefs?.textSize, 85, 130, 100);
  const lib = site.backdrops ?? [];
  if (custom) {
    const mode = custom.modes === "both" ? prefs?.mode || site.mode : custom.modes;
    // their own picture, else the library backdrop they picked, else the site's picture
    const own = custom.background.desktop || custom.background.mobile;
    const pic = own ? undefined : libraryPic(custom.backdrop, lib);
    const background = own ? custom.background : pic ? { ...custom.background, desktop: pic.desktop, mobile: pic.mobile } : { ...custom.background, ...siteBg(site) };
    return { ...custom, mode, textSize, backdrop: drawn(custom.backdrop, lib), background };
  }
  const p = palette(prefs?.scheme || site.scheme);
  // the site's picture, else the library backdrop it uses
  const pic = site.background.desktop || site.background.mobile ? undefined : libraryPic(site.backdrop, lib);
  return {
    dark: p.dark,
    light: p.light,
    mode: prefs?.mode || site.mode,
    display: "saira",
    ui: "saira",
    radius: 14,
    glass: site.glass,
    frame: site.frame,
    backdrop: drawn(site.backdrop, lib),
    grain: true,
    background: { ...siteBg(site), ...(pic ? { desktop: pic.desktop, mobile: pic.mobile } : {}), size: "cover" },
    textSize,
  };
}

function siteBg(site: SiteLook) {
  return { desktop: site.background.desktop, mobile: site.background.mobile, dim: site.background.dim, blur: site.background.blur };
}

/** The stylesheet for a theme. */
export function themeCss(t: ResolvedTheme): string {
  const d = displayFont(t.display);
  const u = uiFont(t.ui);
  const common = [
    `--font-display:${d.css}`,
    `--display-stretch:${d.wide ? "125%" : "100%"}`,
    `--display-wdth:${d.wide ? 125 : 100}`,
    `--font-ui:${u.css}`,
    `--radius:${t.radius}px`,
    `--radius-sm:${Math.max(0, Math.round(t.radius * 0.65))}px`,
    `--radius-xs:${Math.max(0, Math.round(t.radius * 0.45))}px`,
    `--glass-a:${(t.glass / 100).toFixed(2)}`,
    `--text-scale:${t.textSize / 100}`,
    `--bg-dim:${(t.background.dim / 100).toFixed(2)}`,
    `--bg-blur:${t.background.blur}px`,
    `--bg-size:${t.background.size === "tile" ? "auto" : t.background.size}`,
    `--bg-repeat:${t.background.size === "tile" ? "repeat" : "no-repeat"}`,
    `--bg-desktop:${t.background.desktop || t.background.mobile ? `url("${t.background.desktop || t.background.mobile}")` : "none"}`,
    `--bg-mobile:${t.background.mobile || t.background.desktop ? `url("${t.background.mobile || t.background.desktop}")` : "none"}`,
    `--grain-on:${t.grain ? 1 : 0}`,
    `--bg-on:${t.background.desktop || t.background.mobile ? 1 : 0}`,
  ].join(";");
  const dark = varsToCss(cssVars(t.dark));
  const light = varsToCss(cssVars(t.light));
  if (t.mode === "dark") return `:root{${common};${dark}}`;
  if (t.mode === "light") return `:root{${common};${light}}`;
  return `:root{${common};${dark}}@media (prefers-color-scheme: light){:root{${light}}}`;
}

/** The colour of the browser's bars (theme-color). */
export function themeColor(t: ResolvedTheme): { dark: string; light: string } {
  return { dark: t.mode === "light" ? t.light.bg : t.dark.bg, light: t.mode === "dark" ? t.dark.bg : t.light.bg };
}
