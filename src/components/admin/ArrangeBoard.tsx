"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, GripVertical, Newspaper, type LucideIcon } from "lucide-react";
import type { Features } from "@/lib/bootTypes";
import { useT } from "@/components/app/AppProvider";
import { Switch } from "@/components/ui/ui";

export interface ArrangePart {
  label: string;
  icon: LucideIcon;
  /** the feature (Admin → Features) it needs: off there, it says so */
  feature?: keyof Features | null;
}

export interface ArrangeSlot {
  id: string;
  side: string;
  on: boolean;
}

export interface ArrangePlace {
  id: string;
  label: string;
  /** what the arrow to it says: "Move {name} to the left" */
  moveLabel: string;
  /** and its tooltip: "To the left" */
  moveTitle: string;
  /** the feed's box at its end (the middle) */
  feed?: boolean;
  /** a narrow column: no up and down, a part's name above its buttons */
  narrow?: boolean;
}

/**
 * The columns of a page and the parts in them, to arrange (Admin → Front page): drag a part by its
 * handle, within its column or to another, or move it with the arrows (phones, keyboards); its switch
 * takes it off the page. `allowed` says which columns a part may go in. Kept as one list, column by
 * column, in order.
 */
export function ArrangeBoard({
  places,
  parts,
  slots,
  onChange,
  allowed,
  features,
}: {
  places: ArrangePlace[];
  parts: Record<string, ArrangePart>;
  slots: ArrangeSlot[];
  onChange: (slots: ArrangeSlot[]) => void;
  allowed: (id: string, place: string) => boolean;
  features: Features;
}) {
  const t = useT();
  const [dragging, setDragging] = useState<string | null>(null);
  const dragRef = useRef<string | null>(null);
  const cols = Object.fromEntries(places.map((p) => [p.id, slots.filter((x) => x.side === p.id)])) as Record<string, ArrangeSlot[]>;

  /** a part to a column, at a place in it (the end, past the last) */
  const move = (id: string, side: string, at: number) => {
    if (!allowed(id, side)) return;
    const from = slots.find((x) => x.id === id);
    if (!from) return;
    const now = cols[from.side].findIndex((x) => x.id === id);
    if (from.side === side && now === at) return;
    const next = Object.fromEntries(places.map((p) => [p.id, cols[p.id].filter((x) => x.id !== id)])) as Record<string, ArrangeSlot[]>;
    const i = Math.max(0, Math.min(at, next[side].length));
    next[side] = [...next[side].slice(0, i), { ...from, side }, ...next[side].slice(i)];
    onChange(places.flatMap((p) => next[p.id]));
  };
  const end = () => {
    dragRef.current = null;
    setDragging(null);
  };
  const toggle = (id: string, on: boolean) => onChange(slots.map((x) => (x.id === id ? { ...x, on } : x)));
  /** what's dragged may go in this column */
  const takes = (side: string) => !!dragRef.current && allowed(dragRef.current, side);
  /** the next column it may go in, to the left or the right */
  const step = (id: string, from: string, dir: -1 | 1): ArrangePlace | null => {
    const ok = places.filter((p) => p.id === from || allowed(id, p.id));
    return ok[ok.findIndex((p) => p.id === from) + dir] ?? null;
  };

  const row = (p: ArrangeSlot, i: number, place: ArrangePlace) => {
    const { label, icon: Icon, feature } = parts[p.id];
    const name = t(label);
    const off = feature && !features[feature];
    const sideways = (to: ArrangePlace | null, dir: -1 | 1) =>
      to ? (
        <button type="button" className="icon-btn xs" onClick={() => move(p.id, to.id, to.feed ? 0 : cols[to.id].length)} aria-label={t(to.moveLabel, { name })} title={t(to.moveTitle)}>
          {dir < 0 ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}
        </button>
      ) : null;
    return (
      <li
        key={p.id}
        className={`home-arrange-row ${dragging === p.id ? "dragging" : ""} ${p.on && !off ? "" : "off"}`}
        draggable
        onDragStart={(e) => {
          dragRef.current = p.id;
          setDragging(p.id);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", p.id);
        }}
        onDragOver={(e) => {
          const id = dragRef.current;
          if (!id || !takes(place.id)) return;
          e.preventDefault();
          e.stopPropagation();
          if (id === p.id) return;
          // the upper half: before it; the lower: after it
          const r = e.currentTarget.getBoundingClientRect();
          const after = e.clientY > r.top + r.height / 2;
          const mine = cols[place.id].findIndex((x) => x.id === id);
          let at = i + (after ? 1 : 0);
          if (mine !== -1 && mine < at) at -= 1;
          move(id, place.id, at);
        }}
        onDragEnd={end}
      >
        <GripVertical size={16} className="muted arrange-grip" aria-hidden />
        <Icon size={16} className="home-arrange-icon" aria-hidden />
        <span className="grow" style={{ minWidth: 0 }}>
          <b className="ellipsis" style={{ display: "block" }}>
            {name}
          </b>
          {off ? <span className="tiny muted">{t("Off under Features & permissions")}</span> : null}
        </span>
        {place.narrow ? null : (
          <>
            <button type="button" className="icon-btn xs" onClick={() => move(p.id, place.id, i - 1)} disabled={i === 0} aria-label={t("Move {name} up", { name })}>
              <ChevronUp size={15} />
            </button>
            <button type="button" className="icon-btn xs" onClick={() => move(p.id, place.id, i + 1)} disabled={i === cols[place.id].length - 1} aria-label={t("Move {name} down", { name })}>
              <ChevronDown size={15} />
            </button>
          </>
        )}
        {sideways(step(p.id, place.id, -1), -1)}
        {sideways(step(p.id, place.id, 1), 1)}
        <Switch on={p.on} onChange={(v) => toggle(p.id, v)} label={t("Show {name}", { name })} />
      </li>
    );
  };

  return (
    <div className="home-arrange" style={{ ["--arrange-cols" as string]: places.map((p) => (p.narrow ? "172px" : "minmax(0, 1fr)")).join(" ") }}>
      {places.map((place) => (
        <div key={place.id} className={`home-arrange-col ${place.narrow ? "mid" : ""}`}>
          <span className="label">{t(place.label)}</span>
          <ol
            className={`home-arrange-list ${dragging && takes(place.id) && !cols[place.id].some((p) => p.id === dragging) ? "drop" : ""}`}
            onDragOver={(e) => {
              if (!dragRef.current || !takes(place.id)) return;
              e.preventDefault();
              // over the column's empty end: to its end
              if (e.target === e.currentTarget && !cols[place.id].some((p) => p.id === dragRef.current)) move(dragRef.current, place.id, cols[place.id].length);
            }}
            onDrop={(e) => {
              e.preventDefault();
              end();
            }}
          >
            {cols[place.id].map((p, i) => row(p, i, place))}
            {place.feed ? (
              <li className="home-arrange-feed" aria-hidden>
                <Newspaper size={18} />
                <span className="small">{t("The feed")}</span>
              </li>
            ) : cols[place.id].length ? null : (
              <li className="home-arrange-empty tiny muted">{t("Nothing here: the feed takes the room.")}</li>
            )}
          </ol>
        </div>
      ))}
    </div>
  );
}
