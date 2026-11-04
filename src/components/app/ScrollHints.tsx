"use client";

import { useEffect } from "react";

/** The rows that scroll sideways on a narrow screen (their scrollbars hidden): tabs, pills, chips, the front page's strips, Admin's menu. */
export const SIDEWAYS = ".tabs, .pills.scroll, .chip-row, .strip-online, .strip-events, .admin-nav";

/**
 * A row that scrolls sideways shows it: a round arrow at each edge with more past it (data-more="left
 * right" on the row, drawn in base.css), and a tap on the arrow scrolls that way. Rows are found as
 * pages come and go.
 */
export function ScrollHints() {
  useEffect(() => {
    const watched = new Set<HTMLElement>();
    const mark = (el: HTMLElement) => {
      const left = el.scrollLeft > 2;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      const more = [left ? "left" : "", right ? "right" : ""].filter(Boolean).join(" ");
      if (more) {
        if (el.dataset.more !== more) el.dataset.more = more;
      } else if (el.dataset.more) delete el.dataset.more;
    };
    const onScroll = (e: Event) => mark(e.currentTarget as HTMLElement);
    const resized = new ResizeObserver((entries) => entries.forEach((e) => mark(e.target as HTMLElement)));
    const scan = () => {
      for (const el of watched) {
        if (el.isConnected) continue;
        resized.unobserve(el);
        el.removeEventListener("scroll", onScroll);
        watched.delete(el);
      }
      document.querySelectorAll<HTMLElement>(SIDEWAYS).forEach((el) => {
        if (!watched.has(el)) {
          watched.add(el);
          el.addEventListener("scroll", onScroll, { passive: true });
          resized.observe(el);
        }
        mark(el);
      });
    };
    // new pages, and rows whose content changes
    let frame = 0;
    const changed = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    });
    changed.observe(document.body, { childList: true, subtree: true });
    // a tap on an arrow: most of the row's width that way (not whatever's under it)
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(SIDEWAYS);
      const more = el?.dataset.more;
      if (!el || !more) return;
      const r = el.getBoundingClientRect();
      const dir = more.includes("right") && e.clientX > r.right - 38 ? 1 : more.includes("left") && e.clientX < r.left + 38 ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      e.stopPropagation();
      el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
    };
    document.addEventListener("click", onClick, true);
    scan();
    // (the fonts in: widths change)
    void document.fonts?.ready.then(scan);
    return () => {
      changed.disconnect();
      resized.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener("click", onClick, true);
      for (const el of watched) el.removeEventListener("scroll", onScroll);
    };
  }, []);
  return null;
}
