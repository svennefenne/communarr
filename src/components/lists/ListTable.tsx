"use client";

import { useEffect, useRef, useState, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Ellipsis, Eraser, Maximize2, MoveHorizontal, Plus, Trash2, X } from "lucide-react";
import type { ListCell, ListColumn, ListRowView, ListView } from "@/lib/contentTypes";
import type { UserSummary } from "@/lib/types";
import { useLive, useMe, useT, useToast } from "@/components/app/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { useConfirm } from "@/components/ui/ui";
import { Popover } from "@/components/ui/Popover";
import { DateField, TimeField } from "@/components/ui/DateTime";
import { loadMembers } from "@/components/editor/mention";
import { clock, hourCycle } from "@/lib/clock";
import { addRowAction, clearRowAction, listAction, moveRowAction, removeRowAction, setCellAction } from "@/app/actions/lists";
import { typeIcon } from "./columnTypes";

/** A list as the site has it, kept so: live as others fill it in, and after one's own changes. onGone: it was deleted (or can't be seen any more). */
export function useListView(initial: ListView, onGone: () => void) {
  const [l, setL] = useState(initial);
  const refresh = async () => {
    const r = await listAction(initial.id);
    if (r.ok && r.data) setL(r.data);
    else if (r.ok) onGone();
  };
  useLive("list", (d) => {
    const e = d as { id: number; gone?: boolean };
    if (e.id !== initial.id) return;
    if (e.gone) onGone();
    else void refresh();
  });
  return { l, setL, refresh };
}

/** How many columns are out of view at each side of a table that scrolls sideways (past the row's number and its "…", which stay). */
type Hidden = { left: number; right: number };

/** The edges of what's in view between the frozen columns, and the columns' boxes. */
function view(wrap: HTMLElement) {
  const r = wrap.getBoundingClientRect();
  const n = wrap.querySelector("th.lt-n")?.getBoundingClientRect().width ?? 0;
  const a = wrap.querySelector("th.lt-act")?.getBoundingClientRect().width ?? 0;
  const cols = [...wrap.querySelectorAll("thead th:not(.lt-n):not(.lt-act)")].map((th) => th.getBoundingClientRect());
  return { from: r.left + wrap.clientLeft + n, to: r.left + wrap.clientLeft + wrap.clientWidth - a, cols };
}

/**
 * A list's table, filled in right there (each cell as its column says: text, a number, a checkbox, a
 * member, a date, a time, a choice), and its "Add a row": on the list's page, and on its card in Lists
 * when it's shown whole. A table wider than the screen says so: a line above it, a shadow by the frozen
 * columns, and a round button at each side with more ("+3 ›") that brings the next column into view.
 * onBig: a "Big list" button above it (the list's page); big: it's in the big view (nothing above it).
 */
export function ListTable({ l, setL, refresh, onBig, big = false }: { l: ListView; setL: Dispatch<SetStateAction<ListView>>; refresh: () => Promise<void>; onBig?: () => void; big?: boolean }) {
  const t = useT();
  const me = useMe();
  const toast = useToast();
  const { confirm, node } = useConfirm();
  const [members, setMembers] = useState<UserSummary[]>([]);
  useEffect(() => {
    void loadMembers().then((all) => setMembers([...all].sort((a, b) => Number(b.id === me?.id) - Number(a.id === me?.id) || a.name.localeCompare(b.name))));
  }, [me?.id]);
  const people = new Map<number, UserSummary>([...Object.entries(l.people).map(([k, v]) => [Number(k), v] as const), ...members.map((m) => [m.id, m] as const)]);

  // a cell: shown at once, saved, and the row as the site has it after
  const save = async (row: ListRowView, col: ListColumn, value: ListCell | null) => {
    setL((x) => ({ ...x, rowList: x.rowList.map((r) => (r.id === row.id ? { ...r, cells: withCell(r.cells, col.id, value) } : r)) }));
    const r = await setCellAction(l.id, row.id, col.id, value);
    if (!r.ok) {
      toast(r.error, { kind: "err" });
      void refresh();
      return;
    }
    setL((x) => ({ ...x, rowList: x.rowList.map((q) => (q.id === row.id ? r.data : q)) }));
  };
  const run = async (p: Promise<{ ok: boolean; error?: string }>) => {
    const r = await p;
    if (!r.ok) toast(r.error ?? t("Something went wrong. Try again."), { kind: "err" });
    void refresh();
  };

  // Tab and Shift+Tab go from cell to cell like a spreadsheet's (past a row's "…" and a cell's clear
  // button), on to the next row; with automatic rows, Tab in the last cell adds a row
  const body = useRef<HTMLTableSectionElement>(null);
  const [focusRow, setFocusRow] = useState<number | null>(null);
  useEffect(() => {
    if (focusRow === null) return;
    const tr = body.current?.querySelector(`tr[data-row="${focusRow}"]`);
    if (!tr) return;
    setFocusRow(null);
    for (const td of dataCells(tr)) {
      const s = stops(td);
      if (s.length) return s[0].focus();
    }
  }, [focusRow, l]);
  const onTab = (e: KeyboardEvent<HTMLTableSectionElement>) => {
    if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;
    const el = e.target as HTMLElement;
    // (not a date's month, which opens over the page)
    const td = el.closest("td");
    if (!td || !e.currentTarget.contains(td) || td.matches(".lt-n, .lt-act")) return;
    const own = stops(td);
    const k = own.indexOf(el);
    // inside a cell (a time's hour, then its minutes) as usual
    if (k >= 0 && (e.shiftKey ? k > 0 : k < own.length - 1)) return;
    const cells = dataCells(e.currentTarget);
    const i = cells.indexOf(td);
    for (const c of e.shiftKey ? cells.slice(0, i).reverse() : cells.slice(i + 1)) {
      const s = stops(c);
      if (!s.length) continue;
      e.preventDefault();
      return (e.shiftKey ? s[s.length - 1] : s[0]).focus();
    }
    // past the last cell: out of the table, or (automatic rows) a new row
    if (e.shiftKey || !l.autoRows || !l.canAddRows) return;
    e.preventDefault();
    const rowId = Number(td.closest("tr")?.dataset.row);
    // (leaving the cell saves it first)
    el.blur();
    void addRowAction(l.id, rowId).then(async (r) => {
      if (!r.ok) return toast(r.error, { kind: "err" });
      await refresh();
      setFocusRow(r.data);
    });
  };

  // wider than the screen: which columns are out of view, kept as it scrolls, resizes and changes
  const wrap = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState<Hidden>({ left: 0, right: 0 });
  useEffect(() => {
    const w = wrap.current;
    if (!w) return;
    const measure = () => {
      const { from, to, cols } = view(w);
      const left = cols.filter((c) => c.left < from - 2).length;
      const right = cols.filter((c) => c.right > to + 2).length;
      setHidden((h) => (h.left === left && h.right === right ? h : { left, right }));
    };
    measure();
    w.addEventListener("scroll", measure, { passive: true });
    const resized = new ResizeObserver(measure);
    resized.observe(w);
    const table = w.querySelector("table");
    if (table) resized.observe(table);
    return () => {
      w.removeEventListener("scroll", measure);
      resized.disconnect();
    };
  }, []);
  // the next column that way to the edge (or most of a screen, for a column wider than it)
  const scrollCols = (dir: 1 | -1) => {
    const w = wrap.current;
    if (!w) return;
    const { from, to, cols } = view(w);
    const next = dir > 0 ? cols.find((c) => c.right > to + 2) : cols.findLast((c) => c.left < from - 2);
    let by = next ? next.left - from : 0;
    if (Math.abs(by) < 8) by = dir * (to - from) * 0.8;
    w.scrollBy({ left: by, behavior: "smooth" });
  };
  const more = [hidden.left ? "left" : "", hidden.right ? "right" : ""].filter(Boolean).join(" ");

  return (
    <>
      <div className="lt-block">
        {!big && (onBig || more) ? (
          <div className="lt-tools">
            {onBig ? (
              <button type="button" className="btn btn-sm" onClick={onBig} title={t("Only the list, filling the screen")}>
                <Maximize2 size={14} /> {t("Big list")}
              </button>
            ) : null}
            {more ? (
              <span className="tiny muted lt-swipe">
                <MoveHorizontal size={14} /> {t("Scroll sideways for more columns")}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="lt-frame" data-more={more || undefined}>
          <div className="list-table-wrap" ref={wrap}>
            <table className="list-table">
              <thead>
                <tr>
                  <th className="lt-n" aria-label={t("Row")}>
                    #
                  </th>
                  {l.columns.map((c) => {
                    const Icon = typeIcon(c.type);
                    return (
                      <th key={c.id} className={`lt-col-${c.type}`}>
                        <span className="lt-head">
                          <Icon size={13} aria-hidden /> {c.name}
                        </span>
                      </th>
                    );
                  })}
                  <th className="lt-act" aria-label={t("More")} />
                </tr>
              </thead>
              <tbody ref={body} onKeyDown={onTab}>
                {l.rowList.map((r, i) => (
                  <tr key={r.id} data-row={r.id} className={r.filledBy && r.filledBy.id === me?.id ? "mine" : ""}>
                    <td className="lt-n">
                      {r.filledBy ? (
                        <span title={t("{name}'s row", { name: r.filledBy.name })}>
                          <Avatar user={r.filledBy} size={20} />
                        </span>
                      ) : (
                        <span className="mono muted">{i + 1}</span>
                      )}
                    </td>
                    {l.columns.map((c) => (
                      <td key={c.id} className={`lt-col-${c.type}`}>
                        <Cell col={c} value={r.cells[c.id]} edit={r.canEdit} members={members} people={people} onSave={(v) => void save(r, c, v)} />
                      </td>
                    ))}
                    <td className="lt-act">
                      <RowMenu
                        first={!i}
                        last={i === l.rowList.length - 1}
                        canClear={r.canEdit && Object.keys(r.cells).length > 0}
                        canArrange={l.canEdit}
                        onClear={() => void run(clearRowAction(l.id, r.id))}
                        onMove={(by) => void run(moveRowAction(l.id, r.id, by))}
                        onRemove={() => confirm(t("Remove row {n}?", { n: i + 1 }), t("Remove"), () => run(removeRowAction(l.id, r.id)))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hidden.left ? (
            <button type="button" className="lt-more left" tabIndex={-1} onClick={() => scrollCols(-1)} aria-label={t.n(hidden.left, "{n} more column to the left", "{n} more columns to the left")}>
              <ChevronLeft size={15} />+{hidden.left}
            </button>
          ) : null}
          {hidden.right ? (
            <button type="button" className="lt-more right" tabIndex={-1} onClick={() => scrollCols(1)} aria-label={t.n(hidden.right, "{n} more column to the right", "{n} more columns to the right")}>
              +{hidden.right}
              <ChevronRight size={15} />
            </button>
          ) : null}
        </div>
      </div>
      {l.canAddRows ? (
        <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => void run(addRowAction(l.id))}>
          <Plus size={15} /> {t("Add a row")}
        </button>
      ) : null}
      {node}
    </>
  );
}

/** The cells people fill in (not a row's number or its "…"), row by row. */
const dataCells = (el: Element) => [...el.querySelectorAll<HTMLTableCellElement>("td:not(.lt-n):not(.lt-act)")];
/** What Tab stops at in a cell: its controls, not a clear button. */
const stops = (td: Element) => [...td.querySelectorAll<HTMLElement>("input, select, button:not(.icon-btn)")].filter((x) => !(x as HTMLInputElement).disabled);

function withCell(cells: Record<string, ListCell>, id: string, v: ListCell | null) {
  const x = { ...cells };
  if (v === null || v === "" || v === false) delete x[id];
  else x[id] = v;
  return x;
}

/** One cell: its control when it's yours to fill in, else what's in it. */
function Cell({ col, value, edit, members, people, onSave }: { col: ListColumn; value: ListCell | undefined; edit: boolean; members: UserSummary[]; people: Map<number, UserSummary>; onSave: (v: ListCell | null) => void }) {
  const t = useT();
  if (!edit) return <Shown col={col} value={value} people={people} />;
  switch (col.type) {
    case "text":
      return <TextCell value={typeof value === "string" ? value : ""} onSave={(v) => onSave(v.trim() || null)} label={col.name} />;
    case "number":
      return <TextCell value={typeof value === "number" ? String(value) : ""} onSave={(v) => onSave(v.trim() ? v.trim() : null)} label={col.name} numeric />;
    case "check":
      return <input type="checkbox" className="lt-check" checked={value === true} onChange={(e) => onSave(e.target.checked || null)} aria-label={col.name} />;
    case "member":
      return (
        <select className="lt-select" value={typeof value === "number" ? value : ""} onChange={(e) => onSave(e.target.value ? Number(e.target.value) : null)} aria-label={col.name}>
          <option value="">—</option>
          {typeof value === "number" && !members.some((m) => m.id === value) && people.get(value) ? <option value={value}>{people.get(value)!.name}</option> : null}
          {members.map((m, i) => (
            <option key={m.id} value={m.id}>
              {i === 0 ? t("Me ({name})", { name: m.name }) : m.name}
            </option>
          ))}
        </select>
      );
    case "date":
      return <DateField value={typeof value === "string" ? value : ""} onChange={(v) => onSave(v || null)} clearable small floating placeholder="—" label={col.name} />;
    case "time":
      return (
        <span className="lt-time">
          <TimeField value={typeof value === "string" ? value : ""} onChange={(v) => onSave(v)} small label={col.name} />
          {typeof value === "string" ? (
            <button type="button" className="icon-btn xs" onClick={() => onSave(null)} aria-label={t("Clear")} title={t("Clear")}>
              <X size={13} />
            </button>
          ) : null}
        </span>
      );
    case "choice":
      return (
        <select className="lt-select" value={typeof value === "string" ? value : ""} onChange={(e) => onSave(e.target.value || null)} aria-label={col.name}>
          <option value="">—</option>
          {(col.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
  }
}

/** Text or a number: saved when you leave it (or press Enter); what others write meanwhile shows when you're not in it. */
function TextCell({ value, onSave, label, numeric = false }: { value: string; onSave: (v: string) => void; label: string; numeric?: boolean }) {
  const [v, setV] = useState(value);
  const inside = useRef(false);
  useEffect(() => {
    if (!inside.current) setV(value);
  }, [value]);
  return (
    <input
      className={`lt-input ${numeric ? "num" : ""}`}
      value={v}
      inputMode={numeric ? "decimal" : undefined}
      maxLength={300}
      aria-label={label}
      onFocus={() => (inside.current = true)}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        inside.current = false;
        if (v !== value) onSave(v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setV(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

/** What's in a cell, for someone who can't change it. */
function Shown({ col, value, people }: { col: ListColumn; value: ListCell | undefined; people: Map<number, UserSummary> }) {
  const t = useT();
  if (value === undefined || value === null || value === "") return <span className="lt-empty">—</span>;
  switch (col.type) {
    case "check":
      return <input type="checkbox" className="lt-check" checked disabled aria-label={col.name} />;
    case "member": {
      const u = people.get(Number(value));
      return u ? (
        <span className="lt-member">
          <Avatar user={u} size={20} /> {u.name}
        </span>
      ) : (
        <span className="lt-empty">—</span>
      );
    }
    case "date":
      return <span>{new Date(`${value}T12:00`).toLocaleDateString(t.locale, { weekday: "short", day: "numeric", month: "short" })}</span>;
    case "time": {
      const [h, m] = String(value).split(":").map(Number);
      return <span>{new Date(2024, 0, 1, h, m).toLocaleTimeString(t.locale, { hour: "2-digit", minute: "2-digit", ...hourCycle(clock()) })}</span>;
    }
    case "number":
      return <span className="lt-num">{Number(value).toLocaleString(t.locale)}</span>;
    default:
      return <span>{String(value)}</span>;
  }
}

/** A row's "…": empty it (yours), and for the list's author move it or take it away. Over the page, so the table doesn't cut it off. */
function RowMenu({
  first,
  last,
  canClear,
  canArrange,
  onClear,
  onMove,
  onRemove,
}: {
  first: boolean;
  last: boolean;
  canClear: boolean;
  canArrange: boolean;
  onClear: () => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  if (!canClear && !canArrange) return null;
  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <>
      <button ref={btn} type="button" className="icon-btn xs" onClick={() => setOpen((x) => !x)} aria-haspopup="menu" aria-expanded={open} aria-label={t("Row menu")} title={t("More")}>
        <Ellipsis size={15} />
      </button>
      {open ? (
        <Popover anchor={btn.current} onClose={() => setOpen(false)} className="menu">
          {canClear ? (
            <button type="button" className="menu-item" onClick={pick(onClear)}>
              <Eraser size={15} /> {t("Empty the row")}
            </button>
          ) : null}
          {canArrange ? (
            <>
              <button type="button" className="menu-item" disabled={first} onClick={pick(() => onMove(-1))}>
                <ArrowUp size={15} /> {t("Up")}
              </button>
              <button type="button" className="menu-item" disabled={last} onClick={pick(() => onMove(1))}>
                <ArrowDown size={15} /> {t("Down")}
              </button>
              <button type="button" className="menu-item danger" onClick={pick(onRemove)}>
                <Trash2 size={15} /> {t("Remove the row")}
              </button>
            </>
          ) : null}
        </Popover>
      ) : null}
    </>
  );
}
