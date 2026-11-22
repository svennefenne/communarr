"use client";

import { useEffect } from "react";

/**
 * A phone's chat panes (ChatShell), swiped by hand rather than by the browser's scroll snapping: the
 * row follows the finger exactly, and on letting go glides to its pane in a fifth of a second or
 * less (the browser's own settles slowly). A flick is enough to turn a pane; a slow drag turns it
 * past a quarter of the way. The row is a scroll box the page moves (overflow hidden), so nothing in
 * the panes is transformed and the pane showing is simply where it's scrolled to.
 */

const anims = new WeakMap<HTMLElement, number>();
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function stopSlide(el: HTMLElement) {
  const id = anims.get(el);
  if (id) cancelAnimationFrame(id);
  anims.delete(el);
}

/** Glide the row to `to` (its scrollLeft) in `ms`, easing out; 0 (or less motion asked for): at once. */
export function slide(el: HTMLElement, to: number, ms: number) {
  stopSlide(el);
  const from = el.scrollLeft;
  const d = to - from;
  if (Math.abs(d) < 1 || ms <= 0 || reduced()) {
    el.scrollLeft = to;
    return;
  }
  const t0 = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / ms);
    el.scrollLeft = from + d * (1 - (1 - p) ** 3);
    if (p < 1) anims.set(el, requestAnimationFrame(step));
    else anims.delete(el);
  };
  anims.set(el, requestAnimationFrame(step));
}

/** How long to glide `dist` px: about 200ms for a whole pane, quicker for less, never slower than a flick. */
export const glideMs = (dist: number, width: number, speed = 0) => Math.round(Math.min(220, Math.max(90, Math.min(200 * Math.sqrt(dist / Math.max(1, width)), speed > 0 ? dist / speed : Infinity))));

/** something under the finger that scrolls sideways itself (a wide code block): it keeps the swipe */
function sideways(from: HTMLElement, row: HTMLElement) {
  for (let n: HTMLElement | null = from; n && n !== row; n = n.parentElement) {
    const o = getComputedStyle(n).overflowX;
    if ((o === "auto" || o === "scroll") && n.scrollWidth > n.clientWidth + 1) return true;
  }
  return false;
}

interface Drag {
  x: number;
  y: number;
  left: number;
  lock: "x" | null;
  hist: { x: number; t: number }[];
}

export function usePaneSwipe(ref: React.RefObject<HTMLElement | null>, on: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !on) return;
    let d: Drag | null = null;
    let noClickTill = 0;
    let width = el.clientWidth;
    const count = () => [...el.children].filter((c) => c instanceof HTMLElement && c.offsetParent !== null).length;

    const start = (e: TouchEvent) => {
      d = null;
      if (e.touches.length !== 1) return;
      const target = e.target as HTMLElement;
      if (target.closest("input[type=range], [data-no-swipe]") || sideways(target, el)) return;
      const t = e.touches[0];
      d = { x: t.clientX, y: t.clientY, left: el.scrollLeft, lock: null, hist: [] };
    };
    const move = (e: TouchEvent) => {
      if (!d) return;
      const t = e.touches[0];
      if (!d.lock) {
        const dx = t.clientX - d.x;
        const dy = t.clientY - d.y;
        if (Math.hypot(dx, dy) < 8) return;
        // (up and down is the list's: only a mostly sideways move turns the panes)
        if (Math.abs(dx) <= Math.abs(dy) * 1.2) {
          d = null;
          return;
        }
        d.lock = "x";
        // from here, without a jump (and catching a pane still gliding)
        stopSlide(el);
        d.left = el.scrollLeft;
        d.x = t.clientX;
      }
      el.scrollLeft = d.left - (t.clientX - d.x);
      d.hist.push({ x: t.clientX, t: e.timeStamp });
      while (d.hist.length > 2 && e.timeStamp - d.hist[0].t > 90) d.hist.shift();
    };
    const end = (e: TouchEvent) => {
      const g = d;
      d = null;
      if (!g?.lock) return;
      const w = el.clientWidth;
      const from = Math.round(g.left / w);
      const a = g.hist[0];
      const b = g.hist[g.hist.length - 1];
      // px/ms: below 0 the finger went left (towards the pane on the right)
      const v = a && b && b.t > a.t && e.timeStamp - b.t < 80 ? (b.x - a.x) / (b.t - a.t) : 0;
      const moved = el.scrollLeft - g.left;
      let to = from;
      if (Math.abs(v) > 0.3) to = from + (v < 0 ? 1 : -1);
      else if (Math.abs(moved) > w * 0.25) to = from + Math.sign(moved);
      to = Math.max(0, Math.min(count() - 1, to));
      slide(el, to * w, glideMs(Math.abs(to * w - el.scrollLeft), w, Math.abs(v)));
      // (the finger lifting off a link isn't a tap on it)
      noClickTill = performance.now() + 350;
    };
    const click = (e: MouseEvent) => {
      if (performance.now() < noClickTill) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    // a turned phone, or the keyboard: stay on the same pane
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w && width && w !== width && !d) {
        stopSlide(el);
        el.scrollLeft = Math.round(el.scrollLeft / width) * w;
      }
      width = w;
    });
    ro.observe(el);
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: true });
    el.addEventListener("touchend", end, { passive: true });
    el.addEventListener("touchcancel", end, { passive: true });
    el.addEventListener("click", click, true);
    return () => {
      ro.disconnect();
      stopSlide(el);
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
      el.removeEventListener("click", click, true);
    };
  }, [ref, on]);
}
