/**
 * Fonts by id (lib/fonts.ts loads them as CSS variables). Browsers only download the ones in use.
 * Themes pick a display font (titles, tabs) and a UI font (everything else); the editor's font
 * menu offers the content fonts.
 */

export interface FontChoice {
  id: string;
  label: string;
  css: string;
  /** widen the display font (Saira's width axis) */
  wide?: boolean;
}

export const DISPLAY_FONTS: FontChoice[] = [
  { id: "saira", label: "Saira Expanded (poster)", css: "var(--ff-saira), system-ui, sans-serif", wide: true },
  { id: "saira-narrow", label: "Saira", css: "var(--ff-saira), system-ui, sans-serif" },
  { id: "orbitron", label: "Orbitron (sci-fi)", css: "var(--ff-orbitron), system-ui, sans-serif" },
  { id: "bebas", label: "Bebas Neue (tall)", css: "var(--ff-bebas), Impact, sans-serif" },
  { id: "righteous", label: "Righteous (retro)", css: "var(--ff-righteous), system-ui, sans-serif" },
  { id: "space", label: "Space Grotesk", css: "var(--ff-space), system-ui, sans-serif" },
  { id: "playfair", label: "Playfair Display (elegant)", css: "var(--ff-playfair), Georgia, serif" },
  { id: "comfortaa", label: "Comfortaa (rounded)", css: "var(--ff-comfortaa), system-ui, sans-serif" },
  { id: "pixel", label: "Press Start 2P (pixel)", css: "var(--ff-pixel), monospace" },
  { id: "caveat", label: "Caveat (handwritten)", css: "var(--ff-caveat), cursive" },
];

export const UI_FONTS: FontChoice[] = [
  { id: "saira", label: "Saira", css: "var(--ff-saira), system-ui, sans-serif" },
  { id: "inter", label: "Inter", css: "var(--ff-inter), system-ui, sans-serif" },
  { id: "nunito", label: "Nunito (soft)", css: "var(--ff-nunito), system-ui, sans-serif" },
  { id: "atkinson", label: "Atkinson Hyperlegible (easy to read)", css: "var(--ff-atkinson), system-ui, sans-serif" },
  { id: "space", label: "Space Grotesk", css: "var(--ff-space), system-ui, sans-serif" },
  { id: "lora", label: "Lora (serif)", css: "var(--ff-lora), Georgia, serif" },
  { id: "comic", label: "Comic Neue", css: "var(--ff-comic), 'Comic Sans MS', cursive" },
  { id: "system", label: "Your device's own", css: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
];

/** The editor's font menu. `value` is what's written into the post (style="font-family: …"). */
export const CONTENT_FONTS: { id: string; label: string; value: string }[] = [
  { id: "sans", label: "Sans", value: "var(--ff-inter), sans-serif" },
  { id: "serif", label: "Serif", value: "var(--ff-lora), serif" },
  { id: "mono", label: "Monospace", value: "var(--ff-mono), monospace" },
  { id: "poster", label: "Poster", value: "var(--ff-bebas), sans-serif" },
  { id: "scifi", label: "Sci-fi", value: "var(--ff-orbitron), sans-serif" },
  { id: "elegant", label: "Elegant", value: "var(--ff-playfair), serif" },
  { id: "rounded", label: "Rounded", value: "var(--ff-comfortaa), sans-serif" },
  { id: "hand", label: "Handwriting", value: "var(--ff-caveat), cursive" },
  { id: "typewriter", label: "Typewriter", value: "var(--ff-typewriter), monospace" },
  { id: "comic", label: "Comic", value: "var(--ff-comic), cursive" },
  { id: "retro", label: "Retro", value: "var(--ff-righteous), sans-serif" },
  { id: "pixel", label: "Pixel", value: "var(--ff-pixel), monospace" },
];

export const CONTENT_FONT_VALUES = new Set(CONTENT_FONTS.map((f) => f.value));

export const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "30px", "36px", "48px", "64px"];

export const displayFont = (id: string) => DISPLAY_FONTS.find((f) => f.id === id) || DISPLAY_FONTS[0];
export const uiFont = (id: string) => UI_FONTS.find((f) => f.id === id) || UI_FONTS[0];
