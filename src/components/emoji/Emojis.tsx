"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CustomEmoji } from "@/lib/types";
import { useLive } from "@/components/app/AppProvider";

/**
 * The site's own emoji in the browser: the list the page started with, kept current as people add,
 * rename and delete them (the live "emojis" event).
 */

interface EmojiState {
  list: CustomEmoji[];
  byName: Map<string, CustomEmoji>;
  /** a fresher list (what an action answered) */
  set: (list: CustomEmoji[]) => void;
}

const EmojiCtx = createContext<EmojiState>({ list: [], byName: new Map(), set: () => {} });

/** The same list for code outside React (the editor's :name:); EmojiProvider keeps it current. */
export const siteEmojis: { byName: Map<string, CustomEmoji> } = { byName: new Map() };

/** ":party_parrot:" → "party_parrot" (one of the site's own, by its look; null for an emoji) */
export function customName(e: string): string | null {
  return /^:([a-z0-9_]{2,32}):$/.exec(e)?.[1] ?? null;
}

export function EmojiProvider({ initial, children }: { initial: CustomEmoji[]; children: React.ReactNode }) {
  const [list, setList] = useState(initial);
  // a navigation brings the server's list
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    setList(initial);
  }
  useLive("emojis", (d) => Array.isArray(d) && setList(d as CustomEmoji[]));
  const value = useMemo(() => ({ list, byName: new Map(list.map((e) => [e.name, e])), set: setList }), [list]);
  useEffect(() => {
    siteEmojis.byName = value.byName;
  }, [value]);
  return <EmojiCtx.Provider value={value}>{children}</EmojiCtx.Provider>;
}

export const useEmojis = () => useContext(EmojiCtx);

/** An emoji as it's shown: the site's own as its picture, any other as itself. */
export function Emoji({ e, className = "" }: { e: string; className?: string }) {
  const { byName } = useEmojis();
  const name = customName(e);
  const c = name ? byName.get(name) : undefined;
  if (c) return <img className={`emoji-custom ${className}`} src={c.url} alt={e} title={e} draggable={false} />;
  return <>{e}</>;
}

const PICTO = /^(?:\p{Regional_Indicator}{2}|[#*0-9]️?⃣|\p{Extended_Pictographic}️?\p{Emoji_Modifier}?(?:‍\p{Extended_Pictographic}️?\p{Emoji_Modifier}?)*[\u{E0020}-\u{E007F}]*)$/u;

/** Only emoji (the site's own or any), and not too many: a chat message shows them big, like Discord. */
export function onlyEmoji(html: string): boolean {
  const own = html.match(/<img[^>]*data-emoji[^>]*>/g)?.length ?? 0;
  const rest = html
    .replace(/<img[^>]*data-emoji[^>]*>/g, "")
    .replace(/<\/?p>|<br\s*\/?>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, "");
  if (/[<&]/.test(rest)) return false;
  const parts = rest ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(rest)].map((s) => s.segment) : [];
  if (!parts.every((p) => PICTO.test(p))) return false;
  const n = own + parts.length;
  return n > 0 && n <= 27;
}
