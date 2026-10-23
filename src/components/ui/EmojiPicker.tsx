"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";

type Emoji = [string, string, number, string];

const GROUPS: { id: number; icon: string; label: string }[] = [
  { id: -1, icon: "🕘", label: "Recent" },
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

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👀"];

let cache: Emoji[] | null = null;
async function loadEmoji(): Promise<Emoji[]> {
  if (!cache) cache = ((await import("@/lib/emoji.json")).default as unknown) as Emoji[];
  return cache;
}

const RECENT_KEY = "hd.recentEmoji";
function recent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}
function remember(e: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([e, ...recent().filter((x) => x !== e)].slice(0, 32)));
  } catch {
    /* private mode */
  }
}

/** The emoji picker's panel. */
export function EmojiPanel({ onPick, onClose, autoFocus = true }: { onPick: (e: string) => void; onClose?: () => void; autoFocus?: boolean }) {
  const [all, setAll] = useState<Emoji[] | null>(cache);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState(() => (typeof window !== "undefined" && recent().length ? -1 : 0));
  const [recents, setRecents] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setRecents(recent());
    loadEmoji().then(setAll);
    // phones: don't pop the keyboard up over the picker
    if (autoFocus && window.matchMedia("(hover: hover)").matches) input.current?.focus();
  }, [autoFocus]);
  const list = useMemo(() => {
    if (!all) return [];
    const s = q.trim().toLowerCase();
    if (s) return all.filter((e) => e[1].includes(s) || e[3].includes(s)).slice(0, 160);
    if (group === -1) return recents.map((u) => all.find((e) => e[0] === u) || ([u, "", -1, ""] as Emoji));
    return all.filter((e) => e[2] === group);
  }, [all, q, group, recents]);
  const pick = (e: string) => {
    remember(e);
    onPick(e);
  };
  return (
    <div className="emoji-panel" onMouseDown={(e) => e.target instanceof HTMLInputElement || e.preventDefault()}>
      <div className="emoji-search">
        <Search size={15} />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search emoji" aria-label="Search emoji" onKeyDown={(e) => e.key === "Escape" && onClose?.()} />
        {onClose ? (
          <button type="button" className="icon-btn xs" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        ) : null}
      </div>
      {!q ? (
        <div className="emoji-groups" role="tablist">
          {GROUPS.filter((g) => g.id !== -1 || recents.length).map((g) => (
            <button key={g.id} type="button" role="tab" aria-selected={group === g.id} className={group === g.id ? "on" : ""} title={g.label} onClick={() => setGroup(g.id)}>
              {g.icon}
            </button>
          ))}
        </div>
      ) : null}
      <div className="emoji-grid">
        {!all ? <div className="muted small" style={{ gridColumn: "1/-1", padding: 12 }}>Loading…</div> : null}
        {all && !list.length ? <div className="muted small" style={{ gridColumn: "1/-1", padding: 12 }}>No emoji found.</div> : null}
        {list.map((e) => (
          <button key={e[0]} type="button" title={e[1]} onClick={() => pick(e[0])}>
            {e[0]}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The picker next to a button (a popover on a computer, a sheet from the bottom on a phone).
 * `anchor` is the element it opens from.
 */
export function EmojiPopover({ anchor, onPick, onClose }: { anchor: HTMLElement | null; onPick: (e: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const small = window.matchMedia("(max-width: 620px)").matches;
    setPhone(small);
    if (!small && anchor) {
      const r = anchor.getBoundingClientRect();
      const w = 340;
      const h = 380;
      const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
      const top = r.top - h - 8 > 8 ? r.top - h - 8 : Math.min(window.innerHeight - h - 8, r.bottom + 8);
      setPos({ left, top });
    }
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current?.contains(e.target as Node) || anchor?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [anchor, onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    phone ? (
      <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="panel modal emoji-sheet" ref={ref}>
          <EmojiPanel onPick={onPick} onClose={onClose} autoFocus={false} />
        </div>
      </div>
    ) : pos ? (
      <div className="panel emoji-pop" ref={ref} style={{ left: pos.left, top: pos.top }}>
        <EmojiPanel onPick={onPick} onClose={onClose} />
      </div>
    ) : null,
    document.body,
  );
}
