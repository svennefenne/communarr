import type { Lang } from "@/lib/i18n";

/** [emoji, name, group, search words] (scripts/emoji.mjs) */
export type Emoji = [string, string, number, string];

/** the site's own emoji in the picker (custom: those pickers only) */
export const SITE = -2;

/** The emoji picker's groups (Google's animated emoji use the same ones). */
export const GROUPS: { id: number; icon: string; label: string }[] = [
  { id: -1, icon: "🕘", label: "Recent" },
  { id: SITE, icon: "", label: "The site's own" },
  { id: 0, icon: "😀", label: "Smileys" },
  { id: 1, icon: "👋", label: "People" },
  { id: 3, icon: "🐻", label: "Animals & nature" },
  { id: 4, icon: "🍔", label: "Food & drink" },
  { id: 5, icon: "✈️", label: "Travel & places" },
  { id: 6, icon: "⚽", label: "Activities" },
  { id: 7, icon: "💡", label: "Objects" },
  { id: 8, icon: "❤️", label: "Symbols" },
  { id: 9, icon: "🏁", label: "Flags" },
];

// names and search words in the reader's language (scripts/emoji.mjs)
const cache = new Map<Lang, Emoji[]>();
export async function loadEmoji(lang: Lang): Promise<Emoji[]> {
  let list = cache.get(lang);
  if (!list) {
    list = ((lang === "sv" ? await import("@/lib/emoji.sv.json") : await import("@/lib/emoji.json")).default as unknown) as Emoji[];
    cache.set(lang, list);
  }
  return list;
}
/** the list if it's here already (the editor's :name: can't wait for it) */
export function loadedEmoji(lang: Lang): Emoji[] | null {
  return cache.get(lang) ?? null;
}
