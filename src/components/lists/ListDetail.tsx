"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Ellipsis, Eraser, ListChecks, Lock, MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";
import type { ListCell, ListColumn, ListRowView, ListView } from "@/lib/contentTypes";
import type { UserSummary } from "@/lib/types";
import { useLive, useMe, useT, useToast } from "@/components/app/AppProvider";
import { Avatar, UserLink } from "@/components/ui/Avatar";
import { Time } from "@/components/ui/Time";
import { useConfirm } from "@/components/ui/ui";
import { Popover } from "@/components/ui/Popover";
import { DateField, TimeField } from "@/components/ui/DateTime";
import { RichText } from "@/components/content/RichText";
import { Reactions } from "@/components/content/Reactions";
import { Comments } from "@/components/content/Comments";
import { GroupChip } from "@/components/feed/PostCard";
import { loadMembers } from "@/components/editor/mention";
import { clock, hourCycle } from "@/lib/clock";
import { addRowAction, clearRowAction, deleteListAction, listAction, moveRowAction, removeRowAction, setCellAction } from "@/app/actions/lists";
import { typeIcon } from "./columnTypes";

/**
 * A list on its own page: filled in right in the table (each cell as its column says: text, a number,
 * a checkbox, a member, a date, a time, a choice), live as others fill it in too.
 */
export function ListDetail({ list: initial }: { list: ListView }) {
  const t = useT();
  const me = useMe();
  const toast = useToast();
  const router = useRouter();
  const { confirm, node } = useConfirm();
  const [l, setL] = useState(initial);
  const [comments, setComments] = useState(initial.comments);
  const [members, setMembers] = useState<UserSummary[]>([]);
  useEffect(() => {
    void loadMembers().then((all) => setMembers([...all].sort((a, b) => Number(b.id === me?.id) - Number(a.id === me?.id) || a.name.localeCompare(b.name))));
  }, [me?.id]);

  const refresh = async () => {
    const r = await listAction(l.id);
    if (r.ok && r.data) setL(r.data);
    else if (r.ok) router.push("/lists");
  };
  useLive("list", (d) => {
    const e = d as { id: number; gone?: boolean };
    if (e.id !== l.id) return;
    if (e.gone) router.push("/lists");
    else void refresh();
  });

  const people = new Map<number, UserSummary>([...Object.entries(l.people).map(([k, v]) => [Number(k), v] as const), ...members.map((m) => [m.id, m] as const)]);
  const filledCount = l.rowList.filter((r) => Object.keys(r.cells).length).length;

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

  return (
    <div className="stack loose">
      <article className="panel panel-pad list-detail">
        <header className="post-head">
          <span className="kind-icon list">
            <ListChecks size={20} />
          </span>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="row wrap" style={{ gap: "2px 8px" }}>
              <span className="small muted">{t("List by")}</span> <UserLink user={l.author} />
              {l.group ? <GroupChip g={l.group} /> : null}
              {l.private ? (
                <span className="badge" title={t("Only you see it")}>
                  <Lock size={11} /> {t("Only you")}
                </span>
              ) : null}
            </div>
            <div className="tiny muted">
              <Time t={l.createdAt} />
            </div>
          </div>
          {l.canEdit ? (
            <div className="row" style={{ gap: 6 }}>
              <Link href={`/lists/${l.id}/edit`} className="btn btn-sm">
                <Pencil size={14} /> {t("Edit")}
              </Link>
              <button
                type="button"
                className="icon-btn sm"
                aria-label={t("Delete the list")}
                title={t("Delete the list")}
                onClick={() =>
                  confirm(t("Delete “{title}” and everything written in it?", { title: l.title }), t("Delete"), async () => {
                    const r = await deleteListAction(l.id);
                    if (!r.ok) return toast(r.error, { kind: "err" });
                    router.push("/lists");
                    router.refresh();
                  })
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : null}
        </header>
        <h1 className="display list-title">{l.title}</h1>
        {l.html ? <RichText html={l.html} /> : null}
        <p className="tiny muted" style={{ margin: 0 }}>
          {t("{n} of {total} rows filled in", { n: filledCount, total: l.rowList.length })}
          {" · "}
          {l.fill === "owner" ? t("Only {name} fills it in", { name: l.author.name }) : l.ownRows ? t("Everyone fills it in; a filled-in row is its filler's") : t("Everyone fills it in")}
        </p>
      </article>

      <div className="list-table-wrap">
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
          <tbody>
            {l.rowList.map((r, i) => (
              <tr key={r.id} className={r.filledBy && r.filledBy.id === me?.id ? "mine" : ""}>
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
      {l.canAddRows ? (
        <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => void run(addRowAction(l.id))}>
          <Plus size={15} /> {t("Add a row")}
        </button>
      ) : null}
      {/* what people think of it, and talk about it */}
      <section className="panel panel-pad list-talk" id="comments" aria-label={t("Comments")}>
        <footer className="post-foot">
          <Reactions type="list" id={l.id} initial={l.reactions} myName={me?.name ?? ""} />
          <span className="spacer" />
          <span className="small muted row" style={{ gap: 6 }}>
            <MessageSquare size={15} /> {comments ? t.n(comments, "{n} comment", "{n} comments") : t("No comments yet")}
          </span>
        </footer>
        <Comments type="list" id={l.id} onCount={setComments} />
      </section>
      {node}
    </div>
  );
}

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
