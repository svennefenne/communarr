"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Search, Settings2, Sparkles, X } from "lucide-react";
import { useSite, useT } from "@/components/app/AppProvider";
import { customName, NOTO_LICENSE, NOTO_PAGE, useEmojis } from "@/components/emoji/Emojis";
import { AddEmojiDialog, EmojiManagerDialog } from "@/components/emoji/EmojiDialogs";
import { GROUPS, loadEmoji, loadedEmoji, SITE, type Emoji } from "./emojiData";

export { loadEmoji, loadedEmoji } from "./emojiData";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👀"];

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

/**
 * The emoji picker's panel. custom: the site's own emoji too (picked as ":name:"), with a tab of
 * their own where members add them; not for a room's or a status's emoji, which are only emoji.
 */
export function EmojiPanel({ onPick, onClose, autoFocus = true, custom = false }: { onPick: (e: string) => void; onClose?: () => void; autoFocus?: boolean; custom?: boolean }) {
  const t = useT();
  const site = useSite();
  const { list: own, byName } = useEmojis();
  const [all, setAll] = useState<Emoji[] | null>(() => loadedEmoji(t.lang));
  const [q, setQ] = useState("");
  const [picked, setGroup] = useState(() => (typeof window !== "undefined" && recent().length ? -1 : 0));
  const [recents, setRecents] = useState<string[]>([]);
  const [dialog, setDialog] = useState<"add" | "manage" | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setRecents(recent());
    loadEmoji(t.lang).then(setAll);
    // phones: don't pop the keyboard up over the picker
    if (autoFocus && window.matchMedia("(hover: hover)").matches) input.current?.focus();
  }, [autoFocus, t.lang]);
  // the site's own, by their look: those still here, and only where they can be used
  const shownRecents = useMemo(
    () =>
      recents.filter((e) => {
        const name = customName(e);
        return !name || (custom && byName.has(name));
      }),
    [recents, custom, byName],
  );
  // (recent ones that can't be used here: the smileys)
  const group = picked === -1 && !shownRecents.length ? 0 : picked;
  const s = q.trim().toLowerCase();
  const ownFound = custom && s ? own.filter((e) => e.name.includes(s.replace(/:/g, "").replace(/\s+/g, "_"))) : [];
  const list = useMemo(() => {
    if (!all) return [];
    const term = q.trim().toLowerCase();
    if (term) return all.filter((e) => e[1].includes(term) || e[3].includes(term)).slice(0, 160);
    if (group === -1) return shownRecents.map((u) => all.find((e) => e[0] === u) || ([u, "", -1, ""] as Emoji));
    if (group === SITE) return [];
    return all.filter((e) => e[2] === group);
  }, [all, q, group, shownRecents]);
  const pick = (e: string) => {
    remember(e);
    onPick(e);
  };
  // (typing and Escape belong to the dialog now, not the search box)
  const openDialog = (d: "add" | "manage") => {
    input.current?.blur();
    setDialog(d);
  };
  const tile = (e: string, title: string) => {
    const c = byName.get(customName(e) ?? "");
    return (
      <button key={e} type="button" title={title} onClick={() => pick(e)} className={c ? "own" : undefined}>
        {c ? <img src={c.url} alt={e} draggable={false} /> : e}
      </button>
    );
  };
  const groups = GROUPS.filter((g) => (g.id !== -1 || shownRecents.length) && (g.id !== SITE || custom));
  const siteTab = group === SITE && !s;
  return (
    <div className="emoji-panel" onMouseDown={(e) => e.target instanceof HTMLInputElement || e.preventDefault()}>
      <div className="emoji-search">
        <Search size={15} />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search emoji")} aria-label={t("Search emoji")} onKeyDown={(e) => e.key === "Escape" && !dialog && onClose?.()} />
        {onClose ? (
          <button type="button" className="icon-btn xs" onClick={onClose} aria-label={t("Close")}>
            <X size={15} />
          </button>
        ) : null}
      </div>
      {!q ? (
        <div className="emoji-groups" role="tablist">
          {groups.map((g) => (
            <button key={g.id} type="button" role="tab" aria-selected={group === g.id} className={group === g.id ? "on" : ""} title={t(g.label)} aria-label={t(g.label)} onClick={() => setGroup(g.id)}>
              {g.id !== SITE ? g.icon : own[0] ? <img src={own[0].url} alt="" draggable={false} /> : <Sparkles size={17} />}
            </button>
          ))}
        </div>
      ) : null}
      <div className="emoji-grid">
        {siteTab ? (
          <>
            {own.map((e) => tile(`:${e.name}:`, `:${e.name}:`))}
            {site.can.emojis ? (
              <button type="button" className="add" title={t("Add an emoji")} aria-label={t("Add an emoji")} onClick={() => openDialog("add")}>
                <Plus size={20} />
              </button>
            ) : null}
            {own.length ? (
              <button type="button" className="add" title={t("The site's emoji")} aria-label={t("The site's emoji")} onClick={() => openDialog("manage")}>
                <Settings2 size={18} />
              </button>
            ) : null}
            {!own.length ? <div className="muted small emoji-none">{site.can.emojis ? t("None of the site's own yet. Add one: a picture and a name, and a GIF stays animated.") : t("None of the site's own yet.")}</div> : null}
            {/* (Google's are CC BY 4.0: said where they're shown) */}
            {own.some((e) => e.noto) ? (
              <div className="muted tiny emoji-none">
                {t("Some are")}{" "}
                <a href={NOTO_PAGE} target="_blank" rel="noopener noreferrer">
                  {t("Google's Noto Emoji")}
                </a>{" "}
                (
                <a href={NOTO_LICENSE} target="_blank" rel="noopener noreferrer">
                  CC BY 4.0
                </a>
                ).
              </div>
            ) : null}
          </>
        ) : (
          <>
            {!all ? <div className="muted small" style={{ gridColumn: "1/-1", padding: 12 }}>{t("Loading…")}</div> : null}
            {all && !list.length && !ownFound.length ? <div className="muted small" style={{ gridColumn: "1/-1", padding: 12 }}>{t("No emoji found.")}</div> : null}
            {ownFound.map((e) => tile(`:${e.name}:`, `:${e.name}:`))}
            {list.map((e) => tile(e[0], e[1] || e[0]))}
          </>
        )}
      </div>
      {dialog ? (
        // (the dialogs open over the page: what happens in them isn't the panel's)
        <div onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          {dialog === "add" ? <AddEmojiDialog onClose={() => setDialog(null)} /> : <EmojiManagerDialog onClose={() => setDialog(null)} />}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The picker next to a button (a popover on a computer, a sheet from the bottom on a phone).
 * `anchor` is the element it opens from.
 */
export function EmojiPopover({ anchor, onPick, onClose, custom = false }: { anchor: HTMLElement | null; onPick: (e: string) => void; onClose: () => void; custom?: boolean }) {
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
    // a dialog opened from the panel (adding an emoji) is over it, not outside it
    const inDialog = (target: EventTarget | null) => {
      const back = target instanceof Element ? target.closest(".modal-back") : null;
      return !!back && !back.contains(ref.current);
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current?.contains(e.target as Node) || anchor?.contains(e.target as Node) || inDialog(e.target)) return;
      onClose();
    };
    // Escape: the dialog over it goes first
    const dialogOpen = () => [...document.querySelectorAll(".modal-back")].some((back) => !back.contains(ref.current));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !dialogOpen() && onClose();
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
          <EmojiPanel onPick={onPick} onClose={onClose} autoFocus={false} custom={custom} />
        </div>
      </div>
    ) : pos ? (
      <div className="panel emoji-pop" ref={ref} style={{ left: pos.left, top: pos.top }}>
        <EmojiPanel onPick={onPick} onClose={onClose} custom={custom} />
      </div>
    ) : null,
    document.body,
  );
}
