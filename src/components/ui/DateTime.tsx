"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/components/app/AppProvider";
import { clock, weekDays } from "@/lib/clock";

/**
 * Date and time fields that follow the site's clock (Admin → Name & texts), not the browser's
 * language: the calendar starts the week on the site's first day, and times are 24-hour or 12-hour as
 * the site says. Values are the same strings the browser's own fields use: "2026-11-06" and "18:30".
 */

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00`) : null);

/** A day: a button that opens a month to pick from (the week starting on the site's first day). */
export function DateField({
  value,
  onChange,
  min,
  id,
  label,
  placeholder,
  clearable = false,
  small = false,
}: {
  value: string;
  onChange: (v: string) => void;
  /** no earlier day than this ("2026-11-06") */
  min?: string;
  id?: string;
  /** what it's for, for screen readers (a <label for> works too) */
  label?: string;
  /** shown when there's no day yet */
  placeholder?: string;
  /** an "empty" choice (an optional day) */
  clearable?: boolean;
  small?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [right, setRight] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const picked = parse(value);
  const shown = picked
    ? picked.toLocaleDateString(t.locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    : (placeholder ?? t("Pick a day"));

  // closes on a click outside, and on Escape (focus back on the field)
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [open]);

  return (
    <div
      className="date-field"
      ref={wrap}
      onKeyDown={(e) => {
        if (e.key !== "Escape" || !open) return;
        e.preventDefault();
        e.stopPropagation(); // not the modal around it
        setOpen(false);
        wrap.current?.querySelector<HTMLButtonElement>(".date-btn")?.focus();
      }}
    >
      <button
        type="button"
        id={id}
        className={`input date-btn ${small ? "sm" : ""} ${picked ? "" : "no-day"}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label ? `${label}: ${shown}` : undefined}
        onClick={() => {
          // near the right edge, the month opens to the left
          const r = wrap.current?.getBoundingClientRect();
          setRight(!!r && r.left + 300 > window.innerWidth - 8);
          setOpen((x) => !x);
        }}
      >
        <CalendarDays size={15} aria-hidden />
        <span className="ellipsis">{shown}</span>
      </button>
      {open ? (
        <Month
          value={value}
          min={min}
          right={right}
          clearable={clearable}
          onPick={(v) => {
            onChange(v);
            setOpen(false);
            wrap.current?.querySelector<HTMLButtonElement>(".date-btn")?.focus();
          }}
        />
      ) : null}
    </div>
  );
}

function Month({ value, min, right, clearable, onPick }: { value: string; min?: string; right: boolean; clearable: boolean; onPick: (v: string) => void }) {
  const t = useT();
  const today = iso(new Date());
  const start = parse(value) ?? parse(min ?? "") ?? new Date();
  const [shown, setShown] = useState(new Date(start.getFullYear(), start.getMonth(), 1, 12));
  const [focus, setFocus] = useState(value || (min && min > today ? min : today));
  const grid = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const days = weekDays();
  const lead = (shown.getDay() - clock().weekStart + 7) % 7;
  const first = new Date(shown.getFullYear(), shown.getMonth(), 1 - lead, 12);
  const cells = Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i, 12));
  const tooEarly = (d: string) => !!min && d < min;

  // the focused day keeps keyboard focus
  useEffect(() => {
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focus}"]`)?.focus();
  }, [focus, shown]);

  // a day (or a month) on; its month comes into view in the same go, so Enter right after picks it
  const move = (days: number, months = 0) => {
    const f = parse(focus)!;
    const to = new Date(f.getFullYear(), f.getMonth() + months, f.getDate() + days, 12);
    setFocus(iso(to));
    if (to.getMonth() !== shown.getMonth() || to.getFullYear() !== shown.getFullYear()) setShown(new Date(to.getFullYear(), to.getMonth(), 1, 12));
  };
  return (
    <div className={`date-pop panel ${right ? "right" : ""}`} role="dialog" aria-labelledby={titleId}>
      <div className="date-head">
        <button type="button" className="icon-btn xs" onClick={() => move(0, -1)} aria-label={t("Previous month")}>
          <ChevronLeft size={16} />
        </button>
        <b id={titleId} className="date-title">
          {shown.toLocaleDateString(t.locale, { month: "long", year: "numeric" })}
        </b>
        <button type="button" className="icon-btn xs" onClick={() => move(0, 1)} aria-label={t("Next month")}>
          <ChevronRight size={16} />
        </button>
      </div>
      <div
        className="date-grid"
        role="grid"
        ref={grid}
        onKeyDown={(e) => {
          const keys: Record<string, () => void> = {
            ArrowLeft: () => move(-1),
            ArrowRight: () => move(1),
            ArrowUp: () => move(-7),
            ArrowDown: () => move(7),
            PageUp: () => move(0, -1),
            PageDown: () => move(0, 1),
          };
          const fn = keys[e.key];
          if (fn) {
            e.preventDefault();
            fn();
          }
        }}
      >
        {days.map((d) => (
          <span key={d} className="date-wd" role="columnheader">
            {new Date(2024, 0, 7 + d).toLocaleDateString(t.locale, { weekday: "short" }).replace(/\.$/, "")}
          </span>
        ))}
        {cells.map((c) => {
          const d = iso(c);
          const out = c.getMonth() !== shown.getMonth();
          return (
            <button
              key={d}
              type="button"
              data-day={d}
              role="gridcell"
              tabIndex={d === focus ? 0 : -1}
              disabled={tooEarly(d)}
              aria-selected={d === value}
              aria-current={d === today ? "date" : undefined}
              className={`date-day ${out ? "out" : ""} ${d === value ? "on" : ""} ${d === today ? "today" : ""}`}
              onClick={() => onPick(d)}
              onFocus={() => d !== focus && setFocus(d)}
            >
              {c.getDate()}
            </button>
          );
        })}
      </div>
      <div className="date-foot">
        {!tooEarly(today) ? (
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => onPick(today)}>
            {t("Today")}
          </button>
        ) : (
          <span />
        )}
        {clearable && value ? (
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => onPick("")}>
            {t("No date")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * "18:30" as the site writes times: 24-hour, or 12-hour with the language's AM/PM. Hour and minute are
 * picked from lists (minutes in steps, plus the one it has if it's between them). An empty value ("")
 * shows dashes until an hour is picked.
 */
export function TimeField({ value, onChange, id, label, step = 5, small = false }: { value: string; onChange: (v: string) => void; id?: string; label?: string; step?: number; small?: boolean }) {
  const t = useT();
  const set = /^\d{2}:\d{2}$/.test(value);
  const [h, m] = set ? value.split(":").map(Number) : [-1, 0];
  const twelve = clock().timeFormat === "12h";
  const minutes = [...new Set([...Array.from({ length: 60 / step }, (_, i) => i * step), m])].sort((a, b) => a - b);
  const put = (hh: number, mm: number) => onChange(`${pad(hh)}:${pad(mm)}`);
  const ampm = (pm: boolean) => new Date(2024, 0, 1, pm ? 15 : 9).toLocaleTimeString(t.locale, { hour: "numeric", hourCycle: "h12" }).replace(/[\d\s]/g, "");
  const pm = h >= 12;
  return (
    <div className={`time-field ${small ? "sm" : ""}`} role="group" aria-label={label}>
      <select
        id={id}
        className="select"
        value={!set ? "" : twelve ? h % 12 || 12 : h}
        aria-label={t("Hour")}
        onChange={(e) => {
          const v = Number(e.target.value);
          put(twelve ? (v % 12) + (pm ? 12 : 0) : v, m);
        }}
      >
        {!set ? <option value="">--</option> : null}
        {(twelve ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] : Array.from({ length: 24 }, (_, i) => i)).map((x) => (
          <option key={x} value={x}>
            {twelve ? x : pad(x)}
          </option>
        ))}
      </select>
      <span className="time-colon" aria-hidden>
        :
      </span>
      <select className="select" value={set ? m : ""} disabled={!set} aria-label={t("Minute")} onChange={(e) => put(h, Number(e.target.value))}>
        {!set ? <option value="">--</option> : null}
        {minutes.map((x) => (
          <option key={x} value={x}>
            {pad(x)}
          </option>
        ))}
      </select>
      {twelve ? (
        <select className="select" value={pm ? "pm" : "am"} disabled={!set} aria-label={t("Morning or afternoon")} onChange={(e) => put((h % 12) + (e.target.value === "pm" ? 12 : 0), m)}>
          <option value="am">{ampm(false)}</option>
          <option value="pm">{ampm(true)}</option>
        </select>
      ) : null}
    </div>
  );
}
