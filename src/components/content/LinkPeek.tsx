"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LinkPreview } from "@/lib/links";
import { loadPreview } from "./LinkPreviews";

/**
 * A quick look at a link in what someone wrote: resting the pointer on it (or tabbing to it) shows a
 * card with the page's picture, title and a bit of its text (or the picture a link is), and always
 * where it really goes. One for the whole page: it watches the links in written text (.prose, not
 * the editor). Only where there's a pointer that hovers; the card can be clicked too.
 */

interface Peek {
  url: string;
  at: DOMRect;
  /** undefined while it's being fetched, null when the link has no preview */
  p: LinkPreview | null | undefined;
}

/** a link someone wrote that leaves the site (not a mention, not in an editor) */
function linkOf(target: EventTarget | null): HTMLAnchorElement | null {
  const a = target instanceof Element ? target.closest<HTMLAnchorElement>(".prose a[href]") : null;
  if (!a || a.closest(".ed-content") || a.classList.contains("mention")) return null;
  const href = a.getAttribute("href") || "";
  if (!/^https?:\/\//i.test(href)) return null;
  try {
    return new URL(href).origin === location.origin ? null : a;
  } catch {
    return null;
  }
}

/** "https://www.example.com/a%20b?x" → "example.com/a b?x" */
function shown(url: string): string {
  let s = url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
  try {
    s = decodeURI(s);
  } catch {
    /* as it is */
  }
  return s;
}

export function LinkPeekHost() {
  const [peek, setPeek] = useState<Peek | null>(null);
  const cur = useRef<HTMLAnchorElement | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const card = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const hover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const close = () => {
      clearTimeout(showTimer.current);
      clearTimeout(hideTimer.current);
      cur.current = null;
      setPeek(null);
    };
    const open = (a: HTMLAnchorElement) => {
      if (!a.isConnected) return;
      const url = a.getAttribute("href")!;
      cur.current = a;
      setPeek({ url, at: a.getBoundingClientRect(), p: undefined });
      void loadPreview(url).then((p) => setPeek((x) => (x && x.url === url ? { ...x, p } : x)));
    };
    const over = (e: MouseEvent) => {
      if (!hover.matches) return;
      const a = linkOf(e.target);
      if (!a) return;
      clearTimeout(hideTimer.current);
      if (a === cur.current) return;
      // another link: the card that's up goes, this one's comes after a moment
      if (cur.current) close();
      clearTimeout(showTimer.current);
      showTimer.current = setTimeout(() => open(a), 450);
    };
    const out = (e: MouseEvent) => {
      const a = linkOf(e.target);
      if (!a || (e.relatedTarget instanceof Node && a.contains(e.relatedTarget))) return;
      clearTimeout(showTimer.current);
      // a moment to move onto the card
      hideTimer.current = setTimeout(close, 180);
    };
    const focusIn = (e: FocusEvent) => {
      const a = linkOf(e.target);
      if (a && a.matches(":focus-visible")) open(a);
    };
    const focusOut = (e: FocusEvent) => linkOf(e.target) && close();
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    // a press anywhere else puts it away (on the card it opens the link)
    const press = (e: PointerEvent) => !(e.target instanceof Node && card.current?.contains(e.target)) && close();
    // it sits where the link was: scrolling moves the link, so it goes
    const scroll = (e: Event) => !(e.target instanceof Node && card.current?.contains(e.target)) && cur.current && close();
    document.addEventListener("mouseover", over);
    document.addEventListener("mouseout", out);
    document.addEventListener("focusin", focusIn);
    document.addEventListener("focusout", focusOut);
    document.addEventListener("pointerdown", press);
    window.addEventListener("keydown", key);
    window.addEventListener("scroll", scroll, { passive: true, capture: true });
    return () => {
      close();
      document.removeEventListener("mouseover", over);
      document.removeEventListener("mouseout", out);
      document.removeEventListener("focusin", focusIn);
      document.removeEventListener("focusout", focusOut);
      document.removeEventListener("pointerdown", press);
      window.removeEventListener("keydown", key);
      window.removeEventListener("scroll", scroll, { capture: true });
    };
  }, []);

  // under the link (above it when there's no room), on screen
  useLayoutEffect(() => {
    const el = card.current;
    if (!el || !peek) return;
    const { at } = peek;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const gap = 8;
    const left = Math.min(Math.max(8, at.left), vw - w - 8);
    let top = at.bottom + gap;
    if (top + h > vh - 8 && at.top - gap - h >= 8) top = at.top - gap - h;
    el.style.left = `${left}px`;
    el.style.top = `${Math.max(8, Math.min(top, vh - h - 8))}px`;
    el.style.visibility = "visible";
  }, [peek]);

  if (!peek) return null;
  const { url, p } = peek;
  const pic = p?.image ?? null;
  return createPortal(
    <a
      ref={card}
      className={`link-peek ${p?.kind === "image" ? "pic-only" : ""} ${p === undefined ? "loading" : ""}`}
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      role="tooltip"
      tabIndex={-1}
      onMouseEnter={() => clearTimeout(hideTimer.current)}
      onMouseLeave={() => {
        hideTimer.current = setTimeout(() => {
          cur.current = null;
          setPeek(null);
        }, 180);
      }}
    >
      {pic ? <img className="link-peek-pic" src={pic} alt={p?.title ?? ""} /> : null}
      <span className="link-peek-body">
        {p && p.kind !== "image" ? (
          <>
            {p.site ? <span className="link-peek-site">{p.site}</span> : null}
            {p.title ? <b className="link-peek-title">{p.title}</b> : null}
            {p.description ? <span className="link-peek-desc">{p.description}</span> : null}
          </>
        ) : null}
        <span className="link-peek-url">{shown(url)}</span>
      </span>
    </a>,
    document.body,
  );
}
