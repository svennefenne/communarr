"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMe, useT } from "@/components/app/AppProvider";
import { LinkPreviews } from "./LinkPreviews";
import type { LinkPreview } from "@/lib/links";

export function openLightbox(images: { src: string; alt: string }[], index: number) {
  window.dispatchEvent(new CustomEvent("hd:lightbox", { detail: { images, index } }));
}

/**
 * Shows what someone wrote (already cleaned on the server). Mentions go to the profile, pictures
 * open big, a long text can be folded with "Read more", and its links get preview cards (previews:
 * false for none, or the previews the page already has).
 */
export function RichText({
  html,
  className = "",
  fold = 0,
  foldBg,
  previews = true,
}: {
  html: string;
  className?: string;
  fold?: number;
  foldBg?: string;
  previews?: boolean | Record<string, LinkPreview | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const me = useMe();
  const t = useT();
  const [folded, setFolded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (me) el.querySelectorAll<HTMLElement>(`.mention[data-id]`).forEach((m) => m.classList.toggle("me", m.dataset.id?.toLowerCase() === me.username.toLowerCase()));
    if (fold) {
      const check = () => setFolded(el.scrollHeight > fold + 40);
      check();
      const imgs = [...el.querySelectorAll("img")];
      imgs.forEach((i) => i.addEventListener("load", check, { once: true }));
    }
  }, [html, me, fold]);

  const onClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const mention = t.closest<HTMLElement>(".mention[data-id]");
    if (mention) {
      e.preventDefault();
      router.push(`/u/${encodeURIComponent(mention.dataset.id!)}`);
      return;
    }
    if (t.tagName === "IMG" && !t.closest("a")) {
      const imgs = [...(ref.current?.querySelectorAll("img") ?? [])];
      openLightbox(
        imgs.map((i) => ({ src: i.getAttribute("src") || "", alt: i.alt })),
        imgs.indexOf(t as HTMLImageElement),
      );
    }
  };

  const foldable = fold > 0;
  return (
    <>
      <div
        ref={ref}
        className={`prose ${foldable ? `fold ${folded && !open ? "folded" : ""} ${open ? "open" : ""}` : ""} ${className}`}
        style={foldable ? ({ ["--fold" as string]: `${fold}px`, ...(foldBg ? { ["--fold-bg" as string]: foldBg } : {}) } as React.CSSProperties) : undefined}
        onClick={onClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {foldable && folded ? (
        <button type="button" className="btn btn-ghost btn-xs" style={{ marginTop: 6 }} onClick={() => setOpen((o) => !o)}>
          {t(open ? "Show less" : "Read more")}
        </button>
      ) : null}
      {previews !== false ? <LinkPreviews html={html} initial={typeof previews === "object" ? previews : undefined} /> : null}
    </>
  );
}
