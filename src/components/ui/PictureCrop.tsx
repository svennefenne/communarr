"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, Monitor, ZoomIn, ZoomOut } from "lucide-react";
import { Modal } from "./ui";
import { useT } from "@/components/app/AppProvider";

/**
 * What a picture's placed in, in its own pixels as it's kept (uploads.ts): a banner, 3:1, or a picture
 * of someone or a group, square (shown with round corners, or round).
 */
export type CropShape = "banner" | "square" | "round";
const FRAME: Record<CropShape, { W: number; H: number }> = { banner: { W: 1800, H: 600 }, square: { W: 512, H: 512 }, round: { W: 512, H: 512 } };
/**
 * The part of its height a wide screen shows: a group's and a profile's banner (.group-banner in
 * pages.css) is 210px high across a page 1320px wide, so of a 3:1 picture the band across the middle,
 * 210 / (1320 / 3) of it (about 1800 × 287). A phone shows nearly all of it.
 */
export const BANNER_BAND = 210 / (1320 / 3);

/** the picture's place in the frame, in the frame's own pixels: its size (scale) and top left corner */
interface Place {
  s: number;
  x: number;
  y: number;
}

/** kept over the frame (W × H): a side bigger than it covers it, one smaller stays inside it */
const clamp = (p: Place, w: number, h: number, W: number, H: number): Place => {
  const along = (at: number, size: number, room: number) => (size >= room ? Math.min(0, Math.max(room - size, at)) : Math.max(0, Math.min(room - size, at)));
  return { s: p.s, x: along(p.x, w * p.s, W), y: along(p.y, h * p.s, H) };
};
/** at this size, the middle of it at the frame's middle */
const centred = (s: number, w: number, h: number, W: number, H: number): Place => ({ s, x: (W - w * s) / 2, y: (H - h * s) / 2 });

/**
 * Place a picture in its frame: drag it about and zoom. A banner has the band a wide screen shows
 * marked (the rest only a phone shows). Any size of picture: what it doesn't cover is a blurred copy of
 * it. Done, the picture as it'll be kept (a banner 1800 × 600, a square one 512 × 512) as a file to
 * upload. A square one keeps what's see-through in it (the group's colour shows there).
 */
export function PictureCrop({ src, shape = "banner", title, onDone, onCantShow, onClose }: { src: string; shape?: CropShape; title?: string; onDone: (file: File) => Promise<void>; onCantShow: () => void; onClose: () => void }) {
  const t = useT();
  const { W, H } = FRAME[shape];
  const banner = shape === "banner";
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [place, setPlace] = useState<Place>({ s: 1, x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; from: Place; k: number } | null>(null);
  const w = img?.naturalWidth ?? 1;
  const h = img?.naturalHeight ?? 1;
  // zoom: from the whole picture inside the frame to four times what covers it
  const cover = Math.max(W / w, H / h);
  const least = Math.min(W / w, H / h);
  const most = cover * 4;
  const keep = useCallback((p: Place) => clamp(p, w, h, W, H), [w, h, W, H]);

  /** zoom to s, the point at (cx, cy) of the frame staying put */
  const zoom = useCallback(
    (s: number, cx = W / 2, cy = H / 2) =>
      setPlace((p) => {
        const to = Math.max(least, Math.min(most, s));
        return keep({ s: to, x: cx - ((cx - p.x) * to) / p.s, y: cy - ((cy - p.y) * to) / p.s });
      }),
    [least, most, keep, W, H],
  );

  // the mouse wheel zooms (where the pointer is), not the page
  useEffect(() => {
    const el = frame.current;
    if (!el || !img) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const k = W / r.width;
      setPlace((p) => {
        const to = Math.max(least, Math.min(most, p.s * Math.exp(-e.deltaY * 0.0015)));
        const cx = (e.clientX - r.left) * k;
        const cy = (e.clientY - r.top) * k;
        return keep({ s: to, x: cx - ((cx - p.x) * to) / p.s, y: cy - ((cy - p.y) * to) / p.s });
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [img, least, most, keep, W]);

  const use = async () => {
    if (!img || busy) return;
    setBusy(true);
    try {
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      // what the picture doesn't cover: a blurred, darker copy of it (a tiny one stretched, where the canvas
      // can't blur). A square one's only round the picture, so what's see-through in it stays so.
      ctx.save();
      if (!banner) {
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.rect(place.x, place.y, w * place.s, h * place.s);
        ctx.clip("evenodd");
      }
      const fill = cover * 1.15;
      if (typeof ctx.filter === "string") {
        ctx.filter = "blur(28px) brightness(0.75)";
        ctx.drawImage(img, (W - w * fill) / 2, (H - h * fill) / 2, w * fill, h * fill);
        ctx.filter = "none";
      } else {
        const tiny = document.createElement("canvas");
        tiny.width = 48;
        tiny.height = Math.round((48 * H) / W);
        const ts = Math.max(48 / w, tiny.height / h);
        tiny.getContext("2d")!.drawImage(img, (48 - w * ts) / 2, (tiny.height - h * ts) / 2, w * ts, h * ts);
        ctx.drawImage(tiny, 0, 0, W, H);
        ctx.fillStyle = "rgb(0 0 0 / 0.25)";
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
      ctx.drawImage(img, place.x, place.y, w * place.s, h * place.s);
      // (a banner as a JPEG; a square one as a PNG, to keep what's see-through: it's small)
      const type = banner ? "image/jpeg" : "image/png";
      const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, type, 0.92));
      if (!blob) throw new Error(t("The upload didn't work."));
      await onDone(new File([blob], banner ? "banner.jpg" : "picture.png", { type }));
    } finally {
      setBusy(false);
    }
  };

  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const v = img ? Math.log(place.s / least) / Math.log(most / least) : 0;
  // (a square one's blurred copy only round the picture, as it'll be kept)
  const around = banner
    ? undefined
    : (() => {
        const [x1, y1, x2, y2] = [pct(place.x, W), pct(place.y, H), pct(place.x + w * place.s, W), pct(place.y + h * place.s, H)];
        return `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${x1} ${y1}, ${x2} ${y1}, ${x2} ${y2}, ${x1} ${y2}, ${x1} ${y1})`;
      })();
  return (
    <Modal
      title={title ?? t("Place the banner")}
      wide={banner}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className={`btn btn-primary ${busy ? "loading" : ""}`} disabled={!img || busy} onClick={() => void use()}>
            {busy ? <LoaderCircle size={15} className="spin" /> : null} {t("Use it")}
          </button>
        </>
      }
    >
      <div className="stack">
        <div
          ref={frame}
          className={`banner-crop ${banner ? "" : `picture-crop ${shape}`} ${img ? "" : "loading"}`}
          tabIndex={0}
          role="application"
          aria-label={banner ? t("The banner: drag the picture, or use the arrow keys and + and -") : t("The picture: drag it, or use the arrow keys and + and -")}
          onPointerDown={(e) => {
            if (!img) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: place, k: W / e.currentTarget.getBoundingClientRect().width };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || d.id !== e.pointerId) return;
            setPlace(keep({ s: d.from.s, x: d.from.x + (e.clientX - d.x) * d.k, y: d.from.y + (e.clientY - d.y) * d.k }));
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={(e) => {
            const step = (e.shiftKey ? 60 : 15) * (W / 1800);
            const by = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
            if (by) {
              e.preventDefault();
              setPlace((p) => keep({ s: p.s, x: p.x + by[0], y: p.y + by[1] }));
            } else if (e.key === "+" || e.key === "=") zoom(place.s * 1.1);
            else if (e.key === "-") zoom(place.s / 1.1);
          }}
        >
          <div className="banner-crop-around" style={{ clipPath: around }}>
            <div className="banner-crop-fill" style={{ backgroundImage: `url("${src}")` }} />
          </div>
          <img
            src={src}
            alt=""
            draggable={false}
            style={{ left: pct(place.x, W), top: pct(place.y, H), width: pct(w * place.s, W), visibility: img ? "visible" : "hidden" }}
            onLoad={(e) => {
              const el = e.currentTarget;
              if (img) return;
              setImg(el);
              setPlace(centred(Math.max(W / el.naturalWidth, H / el.naturalHeight), el.naturalWidth, el.naturalHeight, W, H));
            }}
            onError={onCantShow}
          />
          {img ? null : <LoaderCircle size={22} className="spin banner-crop-wait" />}
          {banner ? (
            <>
              <div className="banner-crop-band" style={{ top: pct((H * (1 - BANNER_BAND)) / 2, H), height: pct(H * BANNER_BAND, H) }}>
                <span className="banner-crop-tag">
                  <Monitor size={12} /> {t("A computer shows this")}
                </span>
              </div>
              <span className="banner-crop-phone">{t("Only on a phone")}</span>
            </>
          ) : null}
        </div>
        <div className="row wrap" style={{ gap: 10 }}>
          <span className="row grow" style={{ gap: 8, minWidth: 200 }}>
            <ZoomOut size={16} className="muted" aria-hidden />
            <input
              type="range"
              className="grow"
              min={0}
              max={1}
              step={0.001}
              value={v}
              disabled={!img}
              aria-label={t("Zoom")}
              onChange={(e) => zoom(least * Math.pow(most / least, Number(e.target.value)))}
            />
            <ZoomIn size={16} className="muted" aria-hidden />
          </span>
          {banner ? (
            <span className="pills">
              <button type="button" className="pill" disabled={!img} onClick={() => setPlace(centred(cover, w, h, W, H))}>
                {t("Fill the banner")}
              </button>
              <button type="button" className="pill" disabled={!img} onClick={() => setPlace(keep(centred(Math.max(W / w, (H * BANNER_BAND) / h), w, h, W, H)))}>
                {t("Fill the band")}
              </button>
            </span>
          ) : (
            <span className="pills">
              <button type="button" className="pill" disabled={!img} onClick={() => setPlace(centred(cover, w, h, W, H))}>
                {t("Fill it")}
              </button>
              <button type="button" className="pill" disabled={!img} onClick={() => setPlace(centred(least, w, h, W, H))}>
                {t("All of it")}
              </button>
            </span>
          )}
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          {banner
            ? t("Drag the picture to move it, and zoom with the slider or the mouse wheel. The marked band is what a wide screen shows; a phone shows nearly all of it. Where the picture doesn't reach, a blurred copy of it fills in.")
            : t("Drag the picture to move it, and zoom with the slider or the mouse wheel. Where the picture doesn't reach, a blurred copy of it fills in.")}
        </p>
      </div>
    </Modal>
  );
}
