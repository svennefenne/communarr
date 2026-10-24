"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useT } from "@/components/app/AppProvider";
import { clientT } from "@/lib/i18n";

/** A dialog over the page (a sheet from the bottom on phones). Escape or a click outside closes it. */
export function Modal({ title, onClose, children, footer, wide = false, label }: { title?: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean; label?: string }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  if (!mounted) return null;
  return createPortal(
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`panel modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={label || (typeof title === "string" ? title : undefined)} ref={ref}>
        {title !== undefined ? (
          <div className="modal-head">
            <h2 className="h2">{title}</h2>
            <button type="button" className="icon-btn sm" onClick={onClose} aria-label={t("Close")}>
              <X size={18} />
            </button>
          </div>
        ) : null}
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/** Open and close a dropdown; closes on a click outside or Escape. */
export function useDropdown<T extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, toggle: () => setOpen((o) => !o), ref };
}

/** A button with a menu under it. */
export function Dropdown({
  button,
  children,
  align = "right",
  direction = "down",
  label,
  className = "icon-btn sm",
}: {
  button: React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: "left" | "right";
  direction?: "down" | "up";
  label: string;
  className?: string;
}) {
  const { open, setOpen, toggle, ref } = useDropdown();
  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className={className} onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-label={label} title={label}>
        {button}
      </button>
      {open ? (
        <div className={`panel menu ${direction} ${align === "right" ? "right" : ""}`} role="menu" onClick={(e) => (e.target as HTMLElement).closest("a,[data-close]") && setOpen(false)}>
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
      ) : null}
    </div>
  );
}

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" disabled={disabled} onClick={() => onChange(!on)} />;
}

export function Empty({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      {icon ? <div className="empty-icon">{icon}</div> : null}
      <div className="h3">{title}</div>
      {children ? <div className="small" style={{ marginTop: 6 }}>{children}</div> : null}
    </div>
  );
}

/** Ask before doing something that can't be undone. */
export function useConfirm() {
  const t = useT();
  const [ask, setAsk] = useState<{ text: string; yes: string; run: () => void | Promise<unknown> } | null>(null);
  const [pending, start] = useTransition();
  const node = ask ? (
    <Modal
      title={t("Are you sure?")}
      onClose={() => setAsk(null)}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => setAsk(null)}>
            {t("Cancel")}
          </button>
          <button
            type="button"
            className={`btn btn-danger ${pending ? "loading" : ""}`}
            onClick={() =>
              start(async () => {
                await ask.run();
                setAsk(null);
              })
            }
          >
            {ask.yes}
          </button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{ask.text}</p>
    </Modal>
  ) : null;
  return { confirm: (text: string, yes: string, run: () => void | Promise<unknown>) => setAsk({ text, yes, run }), node };
}

/** Uploads a file to /api/upload; resolves to its URL and size. */
export async function uploadFile(file: File, kind: "image" | "avatar" | "banner" | "background" | "cover" | "sound" = "image"): Promise<{ id?: string; url: string; width: number; height: number; thumb?: string }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", kind);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = (await res.json().catch(() => ({}))) as { id?: string; url?: string; width?: number; height?: number; thumb?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error || clientT()("The upload didn't work."));
  return { id: data.id, url: data.url, width: data.width ?? 0, height: data.height ?? 0, thumb: data.thumb };
}

export type { ActionResult } from "@/lib/types";
