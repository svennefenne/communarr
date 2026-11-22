"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";

/**
 * Right-click menus (as on Discord): a right click, a long press on a phone, or the keyboard's menu key
 * (Shift+F10) on something opens what can be done with it, by the pointer. Entries can open a menu of
 * their own beside them (on a phone: under them), and a menu can hold its own controls (a volume, the
 * reactions). One menu at a time, over everything; it goes away on a click outside, Escape, scrolling.
 *
 *   <div {...menuProps(() => [{ label: "View profile", icon: User, run: … }, "sep", …])}>
 */

export type MenuEntry =
  | {
      label: string;
      icon?: LucideIcon;
      run?: () => void;
      danger?: boolean;
      /** a moderator's (tinted) */
      mod?: boolean;
      /** to do with someone sharing their screen (red) */
      live?: boolean;
      /** its key, shown on the right */
      kbd?: string;
      /** a tick box, or (radio) one of a few */
      checked?: boolean;
      radio?: boolean;
      disabled?: boolean;
      sub?: MenuEntry[];
    }
  | "sep"
  | { heading: string }
  | { node: React.ReactNode; key: string };

/** how menus look: dense, lit in the accent (as with the voice under the rooms), or compact, keys on the right (the voice in the room) */
export type MenuLook = "list" | "room";

interface Open {
  x: number;
  y: number;
  items: MenuEntry[];
  look: MenuLook;
  /** a phone: from the bottom */
  sheet: boolean;
  /** opened from the keyboard: the first entry has the focus */
  keys: boolean;
  onClose?: () => void;
}

let current: Open | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function openMenu(o: Omit<Open, "sheet" | "keys"> & { sheet?: boolean; keys?: boolean }) {
  current?.onClose?.();
  current = { sheet: false, keys: false, ...o };
  emit();
}
export function closeMenu() {
  if (!current) return;
  const c = current;
  current = null;
  emit();
  c.onClose?.();
}

let press: { t: ReturnType<typeof setTimeout>; x: number; y: number } | null = null;
/** when a long press last opened a menu (Android sends a right click at its end too) */
let pressedOpen = 0;
/** after a long press opened a menu, the tap's click mustn't follow a link underneath */
let noClickTill = 0;
const clearPress = () => {
  if (press) clearTimeout(press.t);
  press = null;
};
const narrow = () => window.innerWidth < 700;
type Marked = { __menu?: boolean };

/**
 * What a thing needs to open its menu: a right click, a long press (touch), the menu key. The innermost
 * thing with a menu wins (a face in a row: the face's).
 */
export function menuProps(get: () => MenuEntry[], look: MenuLook, onOpen?: () => void) {
  const open = (x: number, y: number, touch: boolean, keys = false) => {
    const items = get();
    if (!items.length) return;
    onOpen?.();
    openMenu({ x, y, items, look, sheet: touch && narrow(), keys });
  };
  return {
    onContextMenu: (e: React.MouseEvent) => {
      const n = e.nativeEvent as Marked;
      if (n.__menu) return;
      n.__menu = true;
      e.preventDefault();
      // (Android sends one at the end of a long press too: that one's open already)
      if (Date.now() - pressedOpen < 700) return;
      open(e.clientX, e.clientY, window.matchMedia("(pointer: coarse)").matches);
    },
    onPointerDown: (e: React.PointerEvent) => {
      const n = e.nativeEvent as Marked;
      if (e.pointerType !== "touch" || n.__menu) return;
      n.__menu = true;
      clearPress();
      const { clientX: x, clientY: y } = e;
      press = {
        x,
        y,
        t: setTimeout(() => {
          press = null;
          pressedOpen = Date.now();
          noClickTill = pressedOpen + 700;
          navigator.vibrate?.(10);
          open(x, y, true);
        }, 450),
      };
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) clearPress();
    },
    onPointerUp: clearPress,
    onPointerCancel: clearPress,
    onClickCapture: (e: React.MouseEvent) => {
      if (Date.now() < noClickTill) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      const n = e.nativeEvent as Marked;
      if (n.__menu || !(e.key === "ContextMenu" || (e.shiftKey && e.key === "F10"))) return;
      n.__menu = true;
      e.preventDefault();
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      open(r.left + Math.min(32, r.width / 2), r.top + r.height / 2, false, true);
    },
  };
}

/** The menu itself, wherever menus are used (once). */
export function ContextMenuHost() {
  const open = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => current,
    () => null,
  );
  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => {
      if (!(e.target as HTMLElement).closest?.(".ctx-menu")) closeMenu();
    };
    const scroll = (e: Event) => {
      if (!(e.target instanceof Node) || !(e.target as HTMLElement).closest?.(".ctx-menu")) closeMenu();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(document.activeElement as HTMLElement | null)?.closest?.(".ctx-sub")) closeMenu();
      if (e.key === "Tab") closeMenu();
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("scroll", scroll, true);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("blur", closeMenu);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("scroll", scroll, true);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("blur", closeMenu);
    };
  }, [open]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    open.sheet ? (
      <div className="ctx-sheet-back" onPointerDown={(e) => e.target === e.currentTarget && closeMenu()}>
        <Panel items={open.items} look={open.look} sheet at={{ x: 0, y: 0 }} keys={open.keys} level={0} />
      </div>
    ) : (
      <Panel items={open.items} look={open.look} sheet={false} at={{ x: open.x, y: open.y }} keys={open.keys} level={0} />
    ),
    document.body,
  );
}

/** a menu's own entries and controls (not those of the menu open beside it) */
const focusables = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>(".ctx-item:not([disabled]), .ctx-node button:not([disabled]), .ctx-node input")].filter((x) => x.closest(".ctx-menu") === el);

function Panel({ items, look, sheet, at, anchor, keys, level, onBack }: { items: MenuEntry[]; look: MenuLook; sheet: boolean; at: { x: number; y: number }; anchor?: DOMRect; keys: boolean; level: number; onBack?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [sub, setSub] = useState<{ i: number; rect: DOMRect; keys: boolean } | null>(null);
  const hover = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || sheet) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const W = window.innerWidth;
    const H = window.innerHeight;
    let left = at.x;
    let top = at.y;
    if (anchor) {
      left = anchor.right + 2;
      top = anchor.top - 6;
      if (left + w > W - 8) left = Math.max(8, anchor.left - w - 2);
    } else if (left + w > W - 8) left = Math.max(8, at.x - w);
    if (top + h > H - 8) top = Math.max(8, H - h - 8);
    setPos({ left, top });
  }, [at.x, at.y, anchor, sheet]);

  // the focus, once it's in place: the first entry from the keyboard, else the menu (the arrows move from there)
  const focused = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (focused.current || !el || (!sheet && !pos)) return;
    focused.current = true;
    if (keys) focusables(el)[0]?.focus({ preventScroll: true });
    else el.focus({ preventScroll: true });
  });

  const onKey = (e: React.KeyboardEvent) => {
    const el = ref.current;
    if (!el) return;
    const list = focusables(el);
    const at = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      const n = list.length;
      if (!n) return;
      const down = e.key === "ArrowDown";
      list[at < 0 ? (down ? 0 : n - 1) : (at + (down ? 1 : n - 1)) % n]?.focus();
    } else if ((e.key === "ArrowLeft" || e.key === "Escape") && level > 0) {
      e.preventDefault();
      e.stopPropagation();
      onBack?.();
    }
  };

  const shown = items.filter((x, i, a) => x !== "sep" || (i > 0 && i < a.length - 1 && a[i - 1] !== "sep"));
  const cls = sheet ? "ctx-sheet" : "";
  return (
    <div
      ref={ref}
      className={`panel ctx-menu ctx-${look} ${cls} ${level ? "ctx-sub" : ""}`}
      role="menu"
      tabIndex={-1}
      style={sheet ? undefined : pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0, visibility: "hidden" }}
      onKeyDown={onKey}
      onContextMenu={(e) => e.preventDefault()}
      // (the finger lifting after a long press: not a press on what's under it in the menu now)
      onClickCapture={(e) => {
        if (Date.now() < noClickTill) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {shown.map((x, i) => {
        if (x === "sep") return <div key={`s${i}`} className="menu-sep" role="separator" />;
        if ("heading" in x) return <div key={`h${i}`} className="menu-label">{x.heading}</div>;
        if ("node" in x)
          return (
            <div key={x.key} className="ctx-node">
              {x.node}
            </div>
          );
        const Icon = x.icon;
        const isOpen = sub?.i === i;
        const role = x.checked !== undefined ? "menuitemcheckbox" : x.radio !== undefined ? "menuitemradio" : "menuitem";
        const item = (
          <button
            key={`i${i}`}
            type="button"
            role={role}
            className={`menu-item ctx-item ${x.danger ? "danger" : ""} ${x.mod ? "mod" : ""} ${x.live ? "live" : ""} ${isOpen ? "sub-open" : ""}`}
            disabled={x.disabled}
            aria-checked={x.checked ?? x.radio}
            aria-haspopup={x.sub ? "menu" : undefined}
            aria-expanded={x.sub ? isOpen : undefined}
            onPointerEnter={(e) => {
              if (sheet || e.pointerType === "touch") return;
              clearTimeout(hover.current);
              const rect = e.currentTarget.getBoundingClientRect();
              hover.current = setTimeout(() => setSub(x.sub ? { i, rect, keys: false } : null), x.sub ? 110 : 160);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" && x.sub) {
                e.preventDefault();
                e.stopPropagation();
                setSub({ i, rect: e.currentTarget.getBoundingClientRect(), keys: true });
              }
            }}
            onClick={(e) => {
              if (x.sub) {
                setSub(isOpen ? null : { i, rect: e.currentTarget.getBoundingClientRect(), keys: e.detail === 0 });
                return;
              }
              closeMenu();
              x.run?.();
            }}
          >
            {Icon ? <Icon size={16} /> : x.radio !== undefined ? <span className={`ctx-radio ${x.radio ? "on" : ""}`} /> : null}
            <span className="grow ellipsis">{x.label}</span>
            {x.kbd ? <kbd className="ctx-kbd">{x.kbd}</kbd> : null}
            {x.checked !== undefined ? <span className={`ctx-check ${x.checked ? "on" : ""}`} /> : null}
            {x.sub ? sheet ? <ChevronDown size={15} className={`ctx-chev ${isOpen ? "open" : ""}`} /> : <ChevronRight size={15} className="ctx-chev" /> : null}
          </button>
        );
        if (!isOpen || !x.sub) return item;
        return sheet ? (
          <div key={`i${i}`} className="ctx-inline">
            {item}
            <div className="ctx-inline-list">
              {x.sub.map((y, j) =>
                y === "sep" || "heading" in y || "node" in y ? null : (
                  <button
                    key={j}
                    type="button"
                    role={y.radio !== undefined ? "menuitemradio" : "menuitem"}
                    aria-checked={y.radio}
                    className={`menu-item ctx-item ${y.danger ? "danger" : ""}`}
                    disabled={y.disabled}
                    onClick={() => {
                      closeMenu();
                      y.run?.();
                    }}
                  >
                    {y.icon ? <y.icon size={16} /> : y.radio !== undefined ? <span className={`ctx-radio ${y.radio ? "on" : ""}`} /> : null}
                    <span className="grow ellipsis">{y.label}</span>
                  </button>
                ),
              )}
            </div>
          </div>
        ) : (
          <span key={`i${i}`} style={{ display: "contents" }}>
            {item}
            <Panel
              items={x.sub}
              look={look}
              sheet={false}
              at={{ x: 0, y: 0 }}
              anchor={sub!.rect}
              keys={sub!.keys}
              level={level + 1}
              onBack={() => {
                setSub(null);
                const el = ref.current;
                ([...(el?.querySelectorAll<HTMLElement>(".ctx-item.sub-open") ?? [])].find((b) => b.closest(".ctx-menu") === el) ?? el)?.focus();
              }}
            />
          </span>
        );
      })}
    </div>
  );
}
