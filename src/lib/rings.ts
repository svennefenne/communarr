/**
 * The rings a member can put around their picture (Settings → Profile). Kept to a list, by name, so
 * what's saved is never CSS. No greens: a green ring outside a picture means its owner is talking
 * in a voice chat, and a member's own ring must never be taken for that.
 */
export const RINGS = {
  red: "#e5484d",
  coral: "#ff7a59",
  orange: "#f08c2e",
  gold: "#e8b931",
  pink: "#e86aa6",
  magenta: "#c84bd3",
  purple: "#8e5cf0",
  indigo: "#5b6cf0",
  blue: "#3b8fef",
  sky: "#5cc8f0",
  silver: "#b9c0cc",
  bronze: "#b07a4a",
  sunset: "conic-gradient(from 210deg, #ff5f6d, #ffc371, #ff5f6d)",
  fire: "conic-gradient(from 30deg, #e5484d, #f08c2e, #e8b931, #f08c2e, #e5484d)",
  ocean: "conic-gradient(from 120deg, #3b8fef, #8e5cf0, #5cc8f0, #3b8fef)",
  candy: "conic-gradient(from 300deg, #e86aa6, #8e5cf0, #5cc8f0, #e86aa6)",
  prism: "conic-gradient(#e5484d, #f08c2e, #e8b931, #5cc8f0, #5b6cf0, #c84bd3, #e5484d)",
} as const;

export type RingKey = keyof typeof RINGS;

/** What each is called (for the picker's labels: the dictionary has them). */
export const RING_NAMES: Record<RingKey, string> = {
  red: "Red",
  coral: "Coral",
  orange: "Orange",
  gold: "Gold",
  pink: "Pink",
  magenta: "Magenta",
  purple: "Purple",
  indigo: "Indigo",
  blue: "Blue",
  sky: "Sky blue",
  silver: "Silver",
  bronze: "Bronze",
  sunset: "Sunset",
  fire: "Fire",
  ocean: "Ocean",
  candy: "Candy",
  prism: "Prism",
};

export const isRing = (k: unknown): k is RingKey => typeof k === "string" && Object.hasOwn(RINGS, k);

/** The ring's CSS (a colour or a gradient), or null for none or one no longer on the list. */
export const ringCss = (k: string | null | undefined) => (isRing(k) ? RINGS[k] : null);
