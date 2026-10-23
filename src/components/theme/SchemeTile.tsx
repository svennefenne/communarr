"use client";

import { Check } from "lucide-react";
import { fullColors, type Colors } from "@/lib/palettes";

/** A scheme in miniature: its background, a panel, text, an accent button and the stripes. */
export function MiniPreview({ c, radius = 10 }: { c: Colors; radius?: number }) {
  const f = fullColors(c);
  return (
    <span className="mini" style={{ background: f.bg, borderRadius: radius }}>
      <span className="mini-stripes">
        {f.stripes.map((s, i) => (
          <i key={i} style={{ background: s }} />
        ))}
      </span>
      <span className="mini-panel" style={{ background: f.surface, borderColor: `${f.border}40` }}>
        <i style={{ background: f.text, width: "70%" }} />
        <i style={{ background: f.text, width: "45%", opacity: 0.55 }} />
        <span className="mini-row">
          <b style={{ background: f.primary }} />
          <b style={{ background: f.secondary, width: 14 }} />
          <b style={{ background: f.tertiary, width: 10 }} />
        </span>
      </span>
    </span>
  );
}

export function SchemeTile({ name, colors, active, onClick, sub }: { name: string; colors: Colors; active: boolean; onClick: () => void; sub?: string }) {
  return (
    <button type="button" className={`scheme-tile ${active ? "on" : ""}`} onClick={onClick} aria-pressed={active} title={name}>
      <MiniPreview c={colors} />
      <span className="scheme-name">
        <span className="ellipsis">{name}</span>
        {active ? <Check size={14} /> : null}
      </span>
      {sub ? <span className="tiny muted ellipsis">{sub}</span> : null}
    </button>
  );
}
