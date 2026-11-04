"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useT, useToast } from "@/components/app/AppProvider";
import { RichEditor, type EditorHandle } from "@/components/editor/Editor";
import { useConfirm } from "@/components/ui/ui";
import type { ListColumnType, ListView } from "@/lib/contentTypes";
import { createListAction, updateListAction } from "@/app/actions/lists";
import { COLUMN_TYPES, TEMPLATES } from "./columnTypes";

interface EditCol {
  /** (for React: a column's place in this form) */
  key: string;
  /** the column's own id (one the list already has) */
  id?: string;
  name: string;
  type: ListColumnType;
  choices: string;
}

let n = 0;
const key = () => `c${++n}`;

/** Make a list, or change one: its title, what it's for, its columns and rows, who sees it and who fills it in. */
export function ListForm({ groups, list, groupId }: { groups: { id: number; name: string }[]; list?: ListView; groupId?: number }) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const ed = useRef<EditorHandle>(null);
  const { confirm, node } = useConfirm();
  const first = TEMPLATES[0];
  const [title, setTitle] = useState(list?.title ?? "");
  const [cols, setCols] = useState<EditCol[]>(() =>
    list
      ? list.columns.map((c) => ({ key: key(), id: c.id, name: c.name, type: c.type, choices: (c.options ?? []).join(", ") }))
      : first.columns.map((c) => ({ key: key(), name: t(c.name), type: c.type, choices: "" })),
  );
  const [rows, setRows] = useState(list?.rows ?? first.rows);
  const [template, setTemplate] = useState(list ? "" : first.id);
  const [where, setWhere] = useState<string>(list ? (list.private ? "me" : "") : groupId ? String(groupId) : "");
  const [fill, setFill] = useState<"members" | "owner">(list?.fill ?? "members");
  const [addRows, setAddRows] = useState(list?.addRows ?? true);
  const [ownRows, setOwnRows] = useState(list?.ownRows ?? true);
  const [pending, start] = useTransition();

  const pick = (id: string) => {
    const tp = TEMPLATES.find((x) => x.id === id);
    if (!tp) return;
    setTemplate(id);
    setCols(tp.columns.map((c) => ({ key: key(), name: t(c.name), type: c.type, choices: "" })));
    setRows(tp.rows);
  };
  const set = (k: string, patch: Partial<EditCol>) => setCols((cs) => cs.map((c) => (c.key === k ? { ...c, ...patch } : c)));
  const move = (i: number, d: number) =>
    setCols((cs) => {
      const j = i + d;
      if (j < 0 || j >= cs.length) return cs;
      const x = [...cs];
      [x[i], x[j]] = [x[j], x[i]];
      return x;
    });

  const save = () =>
    start(async () => {
      const input = {
        title,
        html: ed.current?.getHTML() ?? "",
        columns: cols.map((c) => ({ id: c.id, name: c.name, type: c.type, options: c.type === "choice" ? c.choices.split(",").map((s) => s.trim()).filter(Boolean) : undefined })),
        rows,
        groupId: where && where !== "me" ? Number(where) : null,
        private: where === "me",
        fill,
        addRows,
        ownRows,
      };
      const r = list ? await updateListAction(list.id, input) : await createListAction(input);
      if (!r.ok) return toast(r.error, { kind: "err" });
      ed.current?.clear();
      router.push(`/lists/${list ? list.id : r.data}`);
      router.refresh();
    });

  // a column taken away, or made another kind: what's written in it goes (ask first)
  const losing = list
    ? list.columns.filter((c) => {
        const now = cols.find((x) => x.id === c.id);
        return !now || now.type !== c.type;
      })
    : [];
  const submit = () => (losing.length && list?.filled ? confirm(t("What's written in {columns} goes away.", { columns: losing.map((c) => `“${c.name}”`).join(", ") }), t("Save"), save) : save());

  return (
    <div className="stack loose">
      {!list ? (
        <div className="field">
          <span className="label">{t("Start from")}</span>
          <div className="pills" role="group" aria-label={t("Start from")}>
            {TEMPLATES.map((tp) => (
              <button key={tp.id} type="button" className={`pill ${template === tp.id ? "active" : ""}`} onClick={() => pick(tp.id)}>
                {t(tp.label)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="lf-title">{t("Title")}</label>
        <input id="lf-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t("Wednesday: finger food")} autoFocus={!list} style={{ fontSize: "1.1rem", fontWeight: 700 }} />
      </div>
      <div className="field">
        <span className="label">{t("What it's for (optional)")}</span>
        <RichEditor ref={ed} variant="compact" showToolbar initial={list?.html} placeholder={t("Everyone brings something for the table: write what you're bringing.")} minHeight={60} draftKey={list ? undefined : "list"} />
      </div>
      <div className="field">
        <span className="label">{t("Columns")}</span>
        <div className="stack tight">
          {cols.map((c, i) => (
            <div key={c.key} className="list-col-edit">
              <div className="list-col-edit-row">
                <input className="input" value={c.name} onChange={(e) => set(c.key, { name: e.target.value })} maxLength={60} placeholder={t("Column {n}", { n: i + 1 })} aria-label={t("Column {n}", { n: i + 1 })} />
                <select className="select" value={c.type} onChange={(e) => set(c.key, { type: e.target.value as ListColumnType })} aria-label={t("What goes in it")}>
                  {COLUMN_TYPES.map((ct) => (
                    <option key={ct.type} value={ct.type}>
                      {t(ct.label)}
                    </option>
                  ))}
                </select>
                <span className="list-col-edit-tools">
                  <button type="button" className="icon-btn sm" onClick={() => move(i, -1)} disabled={!i} aria-label={t("Up")} title={t("Up")}>
                    <ArrowUp size={15} />
                  </button>
                  <button type="button" className="icon-btn sm" onClick={() => move(i, 1)} disabled={i === cols.length - 1} aria-label={t("Down")} title={t("Down")}>
                    <ArrowDown size={15} />
                  </button>
                  <button type="button" className="icon-btn sm" onClick={() => setCols((cs) => cs.filter((x) => x.key !== c.key))} disabled={cols.length <= 1} aria-label={t("Remove column {n}", { n: i + 1 })} title={t("Remove")}>
                    <Trash2 size={15} />
                  </button>
                </span>
              </div>
              {c.type === "choice" ? (
                <input className="input sm" value={c.choices} onChange={(e) => set(c.key, { choices: e.target.value })} placeholder={t("The choices, separated by commas: Salad, Bread, Dessert")} aria-label={t("The choices for column {n}", { n: i + 1 })} />
              ) : null}
            </div>
          ))}
          {cols.length < 12 ? (
            <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setCols((cs) => [...cs, { key: key(), name: "", type: "text", choices: "" }])}>
              <Plus size={15} /> {t("Add a column")}
            </button>
          ) : null}
        </div>
      </div>
      <div className="grid-2">
        <div className="stack tight">
          <div className="field">
            <label htmlFor="lf-rows">{t("Rows")}</label>
            <input id="lf-rows" type="number" className="input sm" style={{ width: 110 }} min={1} max={200} value={rows} onChange={(e) => setRows(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} />
            {list ? <span className="hint">{t("Fewer rows takes empty ones away from the end; filled-in rows stay.")}</span> : null}
          </div>
          <div className="field">
            <label htmlFor="lf-where">{t("Who sees it")}</label>
            {list?.group ? (
              <span className="small">{list.group.name}</span>
            ) : (
              <select id="lf-where" className="select" value={where} onChange={(e) => setWhere(e.target.value)}>
                <option value="">{t("Everyone")}</option>
                {!list
                  ? groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))
                  : null}
                <option value="me">{t("Only me")}</option>
              </select>
            )}
          </div>
        </div>
        <div className="stack tight">
          <span className="label">{t("Who fills it in")}</span>
          <div className="pills" role="radiogroup" aria-label={t("Who fills it in")}>
            <button type="button" role="radio" aria-checked={fill === "members"} className={`pill ${fill === "members" ? "active" : ""}`} onClick={() => setFill("members")}>
              {t("Everyone who sees it")}
            </button>
            <button type="button" role="radio" aria-checked={fill === "owner"} className={`pill ${fill === "owner" ? "active" : ""}`} onClick={() => setFill("owner")}>
              {t("Only me")}
            </button>
          </div>
          {fill === "members" ? (
            <>
              <label className="check">
                <input type="checkbox" checked={addRows} onChange={(e) => setAddRows(e.target.checked)} /> {t("Others can add rows")}
              </label>
              <label className="check">
                <input type="checkbox" checked={ownRows} onChange={(e) => setOwnRows(e.target.checked)} /> {t("A filled-in row is its filler's: only they (and you) can change it")}
              </label>
            </>
          ) : null}
        </div>
      </div>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className={`btn btn-primary ${pending ? "loading" : ""}`} disabled={pending || !title.trim()} onClick={submit}>
          <Save size={16} /> {list ? t("Save") : t("Make the list")}
        </button>
      </div>
      {node}
    </div>
  );
}
