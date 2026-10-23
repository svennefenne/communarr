"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { useT } from "@/components/app/AppProvider";

/** Pictures big, one at a time: arrows or swipes for the next, Escape or a tap outside to close. */
export function Lightbox() {
  const t = useT();
  const [state, setState] = useState<{ images: { src: string; alt: string }[]; index: number } | null>(null);
  const touch = useRef<number | null>(null);
  useEffect(() => {
    const on = (e: Event) => setState((e as CustomEvent).detail);
    window.addEventListener("hd:lightbox", on);
    return () => window.removeEventListener("hd:lightbox", on);
  }, []);
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setState(null);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  });
  if (!state) return null;
  const n = state.images.length;
  function step(d: number) {
    setState((s) => (s ? { ...s, index: (s.index + d + s.images.length) % s.images.length } : s));
  }
  const img = state.images[state.index];
  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={t("Picture")}
      onClick={(e) => e.target === e.currentTarget && setState(null)}
      onTouchStart={(e) => (touch.current = e.touches.length === 1 ? e.touches[0].clientX : null)}
      onTouchEnd={(e) => {
        if (touch.current == null || n < 2) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
    >
      <img src={img.src} alt={img.alt} />
      <div className="lb-bar">
        <a className="icon-btn" href={img.src} target="_blank" rel="noopener" aria-label={t("Open the picture on its own")}>
          <ExternalLink size={18} />
        </a>
        <button type="button" className="icon-btn" onClick={() => setState(null)} aria-label={t("Close")}>
          <X size={20} />
        </button>
      </div>
      {n > 1 ? (
        <>
          <button type="button" className="icon-btn" style={{ position: "absolute", left: 10, top: "50%", background: "rgb(255 255 255 / .12)", color: "#fff" }} onClick={() => step(-1)} aria-label={t("Previous")}>
            <ChevronLeft size={22} />
          </button>
          <button type="button" className="icon-btn" style={{ position: "absolute", right: 10, top: "50%", background: "rgb(255 255 255 / .12)", color: "#fff" }} onClick={() => step(1)} aria-label={t("Next")}>
            <ChevronRight size={22} />
          </button>
        </>
      ) : null}
      <div className="lb-cap">
        {img.alt ? `${img.alt} · ` : ""}
        {n > 1 ? `${state.index + 1} / ${n}` : ""}
      </div>
    </div>
  );
}
