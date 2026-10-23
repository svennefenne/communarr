"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

const KEY = "hd.adminFolded";

function folded(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

/** One part of the Admin page: a title that folds it away (remembered), and a link target (#id). */
export function Section({ id, title, icon, hint, children, badge }: { id: string; title: string; icon: React.ReactNode; hint?: string; children: React.ReactNode; badge?: number }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    setOpen(!folded().includes(id) || window.location.hash === `#${id}`);
    const onHash = () => window.location.hash === `#${id}` && setOpen(true);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
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
  return (
    <div className="row" style={{ justifyContent: "flex-end", marginTop: 6 }}>
      <button type="button" className={`btn btn-primary btn-sm ${pending ? "loading" : ""}`} onClick={onSave}>
        Save
      </button>
    </div>
  );
}
