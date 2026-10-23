"use client";

import { themeCss, type ResolvedTheme } from "@/lib/theme";

/**
 * Live preview: the whole site is drawn in a theme while you pick or build it (the server's
 * stylesheet in <head> is swapped), and put back as it was if you don't keep it.
 */
let saved: { css: string; frame?: string; backdrop?: string; mode?: string } | null = null;

export function previewTheme(t: ResolvedTheme) {
  const el = document.getElementById("theme-css");
  const html = document.documentElement;
  if (!el) return;
  if (!saved) saved = { css: el.textContent ?? "", frame: html.dataset.frame, backdrop: html.dataset.backdrop, mode: html.dataset.mode };
  html.classList.add("theme-fade");
  el.textContent = themeCss(t);
  if (t.frame) html.dataset.frame = "on";
  else delete html.dataset.frame;
  html.dataset.backdrop = t.backdrop;
  html.dataset.mode = t.mode;
  clearTimeout((previewTheme as unknown as { t?: ReturnType<typeof setTimeout> }).t);
  (previewTheme as unknown as { t?: ReturnType<typeof setTimeout> }).t = setTimeout(() => html.classList.remove("theme-fade"), 450);
}

/** Done previewing: keep it (the server will send the same), or go back to what was there. */
export function endPreview(keep: boolean) {
  if (!saved) return;
  if (!keep) {
    const el = document.getElementById("theme-css");
    const html = document.documentElement;
    if (el) el.textContent = saved.css;
    if (saved.frame) html.dataset.frame = saved.frame;
    else delete html.dataset.frame;
    if (saved.backdrop) html.dataset.backdrop = saved.backdrop;
    if (saved.mode) html.dataset.mode = saved.mode;
  }
  saved = null;
}
