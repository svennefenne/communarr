"use client";

import { useEffect, useState } from "react";

export interface NavGroup {
  label: string;
  items: { id: string; label: string; badge?: number }[];
}

/** The Admin page's sections down the left (chips along the top on a narrow screen), marking where you are. */
export function AdminNav({ groups }: { groups: NavGroup[] }) {
  const [current, setCurrent] = useState("");
  useEffect(() => {
    const ids = groups.flatMap((g) => g.items.map((i) => i.id));
    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (seen[0]) setCurrent(seen[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [groups]);
  return (
    <nav className="admin-nav" aria-label="Admin sections">
      {groups.map((g) => (
        <div key={g.label} className="admin-nav-group">
          <span className="menu-label">{g.label}</span>
          {g.items.map((i) => (
            <a key={i.id} href={`#${i.id}`} className={`admin-nav-link ${current === i.id ? "on" : ""}`}>
              {i.label}
              {i.badge ? <span className="count-badge" style={{ position: "static", boxShadow: "none" }}>{i.badge}</span> : null}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}
