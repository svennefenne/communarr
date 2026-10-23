"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A panel anchored to a button, drawn above everything (so it isn't cut off by a scrolling toolbar).
 * Closes on a click outside, Escape, or scrolling the page.
 */
export function Popover({ anchor, onClose, children, width, className = "" }: { anchor: HTMLElement | null; onClose: () => void; children: React.ReactNode; width?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const r = anchor.getBoundingClientRect();
    const w = ref.current.offsetWidth;
    const h = ref.current.offsetHeight;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left));
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8 && r.top - h - 6 > 8) top = r.top - h - 6;
    setPos({ left, top: Math.max(8, top) });
  }, [anchor]);
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current?.contains(e.target as Node) || anchor?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onScroll = (e: Event) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [anchor, onClose]);
  return createPortal(
    <div ref={ref} className={`panel popover ${className}`} style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width, visibility: pos ? "visible" : "hidden" }} onMouseDown={(e) => e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.preventDefault()}>
      {children}
    </div>,
    document.body,
  );
}

/** A button that opens a popover. */
export function PopButton({
  label,
  button,
  children,
  className = "tb-btn",
  width,
  active = false,
  disabled = false,
}: {
  label: string;
  button: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  className?: string;
  width?: number;
  active?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`${className} ${active || open ? "on" : ""}`}
        title={label}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
      >
        {button}
      </button>
      {open ? (
        <Popover anchor={ref.current} onClose={() => setOpen(false)} width={width}>
          {children(() => setOpen(false))}
        </Popover>
      ) : null}
    </>
  );
}
