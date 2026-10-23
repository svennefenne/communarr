/**
 * The 98 colour schemes: Hooden's own (the retro poster colours of Deck Force) plus the 97 dual
 * light/dark palettes Muzix uses, from claude-desktop-extra (github.com/patrickjaja/claude-desktop-extra,
 * MIT; its community palettes come from github.com/noctalia-dev/community-palettes).
 * Shared by the server (the first paint) and the browser (live previews).
 */

import raw from "./palettes.json";

export interface Colors {
  bg: string;
  surface: string;
  text: string;
  primary: string;
  secondary: string;
  error: string;
  warning: string;
  success: string;
  border: string;
  /** a third accent (Deck Force's teal); the border colour when a palette has none */
  tertiary?: string;
  /** the six logo stripes; made from the palette when missing */
  stripes?: string[];
}

export type PaletteCategory = "hooden" | "builtin" | "gaming" | "community";

export interface Palette {
  slug: string;
  name: string;
  category: PaletteCategory;
  dark: Colors;
  light: Colors;
}

export const HOODEN: Palette = {
  slug: "hooden",
  name: "Hooden",
  category: "hooden",
  dark: {
    bg: "#070b10",
    surface: "#121b23",
    text: "#efe3c8",
    primary: "#d65a2b",
    secondary: "#e2a634",
    tertiary: "#2f7088",
    error: "#e2533a",
    warning: "#e2a634",
    success: "#5cc46a",
    border: "#c9bda3",
    stripes: ["#efe3c8", "#e2a634", "#cc4a30", "#4f8f50", "#2f74a0", "#2d2833"],
  },
  light: {
    bg: "#ece2cc",
    surface: "#f8f1e2",
    text: "#1c242c",
    primary: "#c9531f",
    secondary: "#a26d12",
    tertiary: "#2a6a82",
    error: "#b3421c",
    warning: "#a26d12",
    success: "#2c7436",
    border: "#3b444c",
    stripes: ["#1c242c", "#e2a634", "#cc4a30", "#4f8f50", "#2f74a0", "#2d2833"],
  },
};

export const PALETTES: Palette[] = [HOODEN, ...(raw as Palette[])];
export const PALETTE_BY_SLUG = new Map(PALETTES.map((p) => [p.slug, p]));
export const CATEGORY_LABEL: Record<PaletteCategory, string> = {
  hooden: "Hooden",
  builtin: "Classics",
  gaming: "Gaming",
  community: "Community",
};

export function palette(slug: string | null | undefined): Palette {
  return (slug && PALETTE_BY_SLUG.get(slug)) || HOODEN;
}

// ── colour maths ──

export function hexToRgb(hex: string): [number, number, number] {
  let h = (hex || "#000").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (c: number[]) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

function lum([r, g, b]: [number, number, number]) {
  const f = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function isDark(hex: string) {
  return lum(hexToRgb(hex)) < 0.25;
}

/** Black or white, whichever reads better on `hex`. */
export function onColor(hex: string) {
  return lum(hexToRgb(hex)) > 0.36 ? "#0b0d10" : "#fff8ec";
}

export function mix(a: string, b: string, t: number) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

const rgbTriplet = (hex: string) => hexToRgb(hex).join(" ");

export function isHex(s: unknown): s is string {
  return typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s);
}

export const COLOR_KEYS = ["bg", "surface", "text", "primary", "secondary", "tertiary", "success", "warning", "error", "border"] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];
export const COLOR_LABEL: Record<ColorKey, string> = {
  bg: "Background",
  surface: "Panels",
  text: "Text",
  primary: "Accent (buttons, active tabs)",
  secondary: "Second accent (labels, highlights)",
  tertiary: "Third accent (your name tag, glows)",
  success: "Success",
  warning: "Warning",
  error: "Danger",
  border: "Lines",
};

/** Every colour filled in (a palette's optional ones derived). */
export function fullColors(c: Colors): Required<Colors> {
  const tertiary = c.tertiary || c.border;
  return {
    ...c,
    tertiary,
    stripes: c.stripes?.length === 6 ? c.stripes : [c.text, c.secondary, c.primary, c.success, tertiary, mix(c.bg, c.text, 0.18)],
  };
}

/** The CSS custom properties for one set of colours. Every stylesheet works from these. */
export function cssVars(input: Colors): Record<string, string> {
  const c = fullColors(input);
  const dark = isDark(c.bg);
  const white = "#ffffff";
  const vars: Record<string, string> = {
    "--bg": c.bg,
    "--bg-rgb": rgbTriplet(c.bg),
    "--bg-1": mix(c.bg, c.surface, 0.45),
    "--surface": c.surface,
    "--surface-2": dark ? mix(c.surface, c.text, 0.035) : mix(c.surface, white, 0.55),
    "--surface-3": dark ? mix(c.surface, c.text, 0.085) : mix(c.surface, c.text, 0.07),
    "--text": c.text,
    "--text-rgb": rgbTriplet(c.text),
    "--text-dim": mix(c.text, c.bg, 0.2),
    "--muted": mix(c.text, c.bg, 0.42),
    "--faint": mix(c.text, c.bg, 0.6),
    "--text-strong": dark ? mix(c.text, white, 0.45) : mix(c.text, "#000000", 0.2),
    "--accent": c.primary,
    "--accent-rgb": rgbTriplet(c.primary),
    "--on-accent": onColor(c.primary),
    "--accent-hover": dark ? mix(c.primary, white, 0.12) : mix(c.primary, "#000000", 0.1),
    "--accent-2": c.secondary,
    "--accent-2-rgb": rgbTriplet(c.secondary),
    "--on-accent-2": onColor(c.secondary),
    "--accent-3": c.tertiary,
    "--accent-3-rgb": rgbTriplet(c.tertiary),
    "--accent-3-deep": dark ? mix(c.tertiary, c.bg, 0.55) : mix(c.tertiary, white, 0.75),
    "--on-accent-3-deep": dark ? mix(c.text, white, 0.3) : mix(c.text, "#000000", 0.1),
    "--ok": c.success,
    "--warn": c.warning,
    "--err": c.error,
    "--err-rgb": rgbTriplet(c.error),
    "--on-err": onColor(c.error),
    "--line": `rgb(${rgbTriplet(dark ? c.border : c.text)} / ${dark ? 0.1 : 0.13})`,
    "--line-strong": `rgb(${rgbTriplet(dark ? c.border : c.text)} / ${dark ? 0.2 : 0.25})`,
    "--hover": `rgb(${rgbTriplet(c.text)} / ${dark ? 0.08 : 0.07})`,
    "--field": dark ? `rgb(${rgbTriplet(mix(c.bg, "#000000", 0.2))} / 0.6)` : mix(c.surface, white, 0.7),
    "--overlay": dark ? "rgb(0 0 0 / 0.62)" : `rgb(${rgbTriplet(mix(c.text, c.bg, 0.3))} / 0.4)`,
    "--shadow": dark
      ? "0 18px 40px -18px rgb(0 0 0 / 0.8), 0 2px 0 rgb(255 255 255 / 0.02) inset"
      : `0 16px 34px -20px rgb(${rgbTriplet(mix(c.text, "#5a3c0a", 0.5))} / 0.45), 0 1px 0 rgb(255 255 255 / 0.6) inset`,
    "--glow": `rgb(${rgbTriplet(c.secondary)} / 0.4)`,
    "--grain": dark ? "0.07" : "0.05",
    "--grain-invert": dark ? "0" : "1",
    "color-scheme": dark ? "dark" : "light",
  };
  c.stripes.forEach((s, i) => (vars[`--stripe-${i + 1}`] = s));
  return vars;
}

export function varsToCss(vars: Record<string, string>) {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}
