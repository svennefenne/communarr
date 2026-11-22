"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Images, Shuffle } from "lucide-react";
import { useT } from "@/components/app/AppProvider";
import { Modal } from "@/components/ui/ui";
import { Avatar } from "@/components/ui/Avatar";
import type { AvatarPreset } from "@/lib/avatarPresets";
import type { UserSummary } from "@/lib/types";

const TILE = 76;
const GAP = 14;

/**
 * "Choose an avatar": the site's avatars (Admin → Avatars), round as they'll show, a page at a time
 * (as many as fit the window, so there's never a long scroll), with the one you're looking at big
 * at the top, wearing your ring. Pages turn with the arrows, a page's number, a swipe on a phone, or
 * Page Up/Down; Shuffle lands on any of them.
 */
export function AvatarChooser({ presets, value, onPick, me }: { presets: AvatarPreset[]; value: string | null; onPick: (url: string) => void; me: Pick<UserSummary, "id" | "name" | "accent" | "ring"> }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!presets.length) return null;
  return (
    <>
      <button type="button" className="btn btn-ghost btn-xs" onClick={() => setOpen(true)}>
        <Images size={13} /> {t("Choose an avatar")}
      </button>
      {open ? (
        <Browser
          presets={presets}
          value={value}
          me={me}
          onClose={() => setOpen(false)}
          onPick={(url) => {
            onPick(url);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function Browser({ presets, value, me, onClose, onPick }: { presets: AvatarPreset[]; value: string | null; me: Pick<UserSummary, "id" | "name" | "accent" | "ring">; onClose: () => void; onPick: (url: string) => void }) {
  const t = useT();
  const [sel, setSel] = useState<string | null>(value && presets.some((a) => a.url === value) ? value : null);
  // the first avatar on the page shown: kept when the page holds more or fewer (a turned phone)
  const [first, setFirst] = useState(() => Math.max(0, presets.findIndex((a) => a.url === value)));
  // how many a page holds, and how tall it is (the last page, with fewer, keeps the height)
  const [fit, setFit] = useState({ per: 24, h: 0 });
  const per = fit.per;
  // (the dialog draws itself a moment after it's opened: the grid is measured once it's there)
  const [grid, setGrid] = useState<HTMLDivElement | null>(null);

  // as many as fit: the grid's columns, and the rows the window has room for
  useEffect(() => {
    const el = grid;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth;
      const cols = Math.max(3, Math.floor((w + GAP) / (TILE + GAP)));
      const tile = (w - (cols - 1) * GAP) / cols;
      // the rows that fit what the dialog may be, less its title, the preview, the page numbers and the buttons
      const modal = el.closest<HTMLElement>(".modal");
      const most = modal ? parseFloat(getComputedStyle(modal).maxHeight) : NaN;
      const room = (Number.isFinite(most) ? most : window.innerHeight - 32) - (modal ? modal.scrollHeight - el.offsetHeight : 330);
      const rows = Math.max(2, Math.min(6, Math.floor((room + GAP) / (tile + GAP))));
      const h = Math.round(rows * tile + (rows - 1) * GAP);
      setFit((f) => (f.per === cols * rows && f.h === h ? f : { per: cols * rows, h }));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [grid]);

  const pages = Math.max(1, Math.ceil(presets.length / per));
  const page = Math.min(pages - 1, Math.floor(first / per));
  const go = (p: number) => setFirst(Math.max(0, Math.min(pages - 1, p)) * per);
  const shown = presets.slice(page * per, page * per + per);

  const shuffle = () => {
    const pool = presets.filter((a) => a.url !== sel);
    if (!pool.length) return;
    const a = pool[Math.floor(Math.random() * pool.length)];
    setSel(a.url);
    setFirst(presets.indexOf(a));
  };

  // a swipe across the grid on a phone turns the page
  const touch = useRef<{ x: number; y: number } | null>(null);

  return (
    <Modal
      title={t("Choose an avatar")}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={shuffle}>
            <Shuffle size={16} /> {t("Shuffle")}
          </button>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" disabled={!sel || sel === value} onClick={() => sel && onPick(sel)}>
            <Check size={16} /> {t("Use this one")}
          </button>
        </>
      }
    >
      <div className="avatar-browse">
        <div className="avatar-preview">
          <Avatar user={{ ...me, avatar: sel ?? value }} size={84} />
          <div className="stack tight" style={{ minWidth: 0 }}>
            <b>{sel ? (sel === value ? t("The one you have") : t("How it will look")) : t("Pick one below")}</b>
            <span className="small muted">{t.n(presets.length, "{n} avatar to choose from", "{n} avatars to choose from")}</span>
            <span className="tiny muted">{t("Then save your profile.")}</span>
          </div>
        </div>
        <div
          ref={setGrid}
          className="avatar-grid pick"
          role="radiogroup"
          aria-label={t("Choose an avatar")}
          style={{ minHeight: fit.h || undefined }}
          onKeyDown={(e) => {
            if (e.key === "PageDown" || e.key === "PageUp") {
              e.preventDefault();
              go(page + (e.key === "PageDown" ? 1 : -1));
            }
          }}
          onTouchStart={(e) => {
            const p = e.touches[0];
            touch.current = { x: p.clientX, y: p.clientY };
          }}
          onTouchEnd={(e) => {
            const s = touch.current;
            touch.current = null;
            const p = e.changedTouches[0];
            if (!s || !p) return;
            const dx = p.clientX - s.x;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(p.clientY - s.y) * 1.5) go(page + (dx < 0 ? 1 : -1));
          }}
        >
          {shown.map((a) => {
            const on = a.url === sel;
            return (
              <button key={a.id} type="button" role="radio" aria-checked={on} className={`avatar-tile ${on ? "on" : ""}`} onClick={() => setSel(a.url)} onDoubleClick={() => onPick(a.url)}>
                <img src={a.url} alt="" loading="lazy" decoding="async" />
                {on ? (
                  <span className="avatar-on">
                    <Check size={14} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {pages > 1 ? <Pager page={page} pages={pages} go={go} /> : null}
      </div>
    </Modal>
  );
}

/** ‹ 1 … 4 5 6 … 14 › on a computer; ‹ 5 / 14 › on a phone. */
function Pager({ page, pages, go }: { page: number; pages: number; go: (p: number) => void }) {
  const t = useT();
  const nums: (number | null)[] = [];
  for (let i = 0; i < pages; i++) {
    if (i === 0 || i === pages - 1 || Math.abs(i - page) <= 1 || pages <= 7) nums.push(i);
    else if (nums[nums.length - 1] !== null) nums.push(null);
  }
  return (
    <nav className="avatar-pager" aria-label={t("Pages")}>
      <button type="button" className="icon-btn sm" onClick={() => go(page - 1)} disabled={page === 0} aria-label={t("Previous page")}>
        <ChevronLeft size={18} />
      </button>
      <span className="pager-nums">
        {nums.map((n, i) =>
          n === null ? (
            <span key={`gap${i}`} className="pager-gap">
              …
            </span>
          ) : (
            <button key={n} type="button" className={`pager-num ${n === page ? "on" : ""}`} aria-current={n === page ? "page" : undefined} onClick={() => go(n)}>
              {n + 1}
            </button>
          ),
        )}
      </span>
      <span className="pager-of small muted">{t("{n} of {m}", { n: page + 1, m: pages })}</span>
      <button type="button" className="icon-btn sm" onClick={() => go(page + 1)} disabled={page === pages - 1} aria-label={t("Next page")}>
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}
