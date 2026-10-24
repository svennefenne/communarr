"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useT } from "@/components/app/AppProvider";

const KEY = "hd.adminFolded";

function folded(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

/** "Collapse all" / "Expand all" tells every section at once (and remembers it like a single fold). */
const FOLD_ALL = "hd:admin-fold-all";

/** The two buttons at the top of the Admin page. */
export function FoldAll() {
  const t = useT();
  const all = (open: boolean) => {
    try {
      const ids = [...document.querySelectorAll<HTMLElement>(".admin-section")].map((s) => s.id);
      localStorage.setItem(KEY, JSON.stringify(open ? [] : ids));
    } catch {
      /* private mode */
    }
    window.dispatchEvent(new CustomEvent(FOLD_ALL, { detail: open }));
  };
  return (
    <div className="pills" role="group" aria-label={t("All sections")}>
      <button type="button" className="pill" onClick={() => all(false)}>
        <ChevronsDownUp size={14} /> {t("Collapse all")}
      </button>
      <button type="button" className="pill" onClick={() => all(true)}>
        <ChevronsUpDown size={14} /> {t("Expand all")}
      </button>
    </div>
  );
}

/** One part of the Admin page: a title that folds it away (remembered), and a link target (#id). */
export function Section({ id, title, icon, hint, children, badge }: { id: string; title: string; icon: React.ReactNode; hint?: string; children: React.ReactNode; badge?: number }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    setOpen(!folded().includes(id) || window.location.hash === `#${id}`);
    const onHash = () => window.location.hash === `#${id}` && setOpen(true);
    const onAll = (e: Event) => setOpen((e as CustomEvent<boolean>).detail);
    window.addEventListener("hashchange", onHash);
    window.addEventListener(FOLD_ALL, onAll);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener(FOLD_ALL, onAll);
    };
  }, [id]);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      const f = new Set(folded());
      if (next) f.delete(id);
      else f.add(id);
      localStorage.setItem(KEY, JSON.stringify([...f]));
    } catch {
      /* private mode */
    }
  };
  return (
    <section className="panel admin-section" id={id}>
      <button type="button" className="admin-section-head" onClick={toggle} aria-expanded={open}>
        <span className="admin-section-icon">{icon}</span>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="h2" style={{ fontSize: "1.1rem" }}>
            {title}
          </span>
          {hint ? <span className="small muted admin-hint">{hint}</span> : null}
        </span>
        {badge ? <span className="badge hot">{badge}</span> : null}
        <ChevronDown size={18} className={`admin-chevron ${open ? "open" : ""}`} />
      </button>
      {open ? <div className="admin-section-body">{children}</div> : null}
    </section>
  );
}

/** Save a group of settings: a button that says when it's done. */
export function SaveBar({ onSave, pending }: { onSave: () => void; pending: boolean }) {
  const t = useT();
  return (
    <div className="row" style={{ justifyContent: "flex-end", marginTop: 6 }}>
      <button type="button" className={`btn btn-primary btn-sm ${pending ? "loading" : ""}`} onClick={onSave}>
        {t("Save")}
      </button>
    </div>
  );
}
