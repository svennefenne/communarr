"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowUp, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import type { CategoryView } from "@/lib/contentTypes";
import { useApp, useT, useToast } from "@/components/app/AppProvider";
import { Modal, useConfirm } from "@/components/ui/ui";
import { deleteCategoryAction, moveCategoryAction, saveCategoryAction } from "@/app/actions/admin";

interface Edit {
  id?: number;
  name: string;
  description: string;
  color: string;
  icon: string;
  locked: boolean;
  groupId: number | null;
}

const COLORS = ["#d65a2b", "#e2a634", "#2f7088", "#4f8f50", "#9c5bb5", "#d4689a", "#5b7bd6", "#c8412f"];

export function ForumCategories({ cats, groups }: { cats: CategoryView[]; groups: { id: number; name: string }[] }) {
  const { me } = useApp();
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [edit, setEdit] = useState<Edit | null>(null);
  const { confirm, node } = useConfirm();
  const run = async (p: Promise<{ ok: boolean; error?: string }>) => {
    const r = await p;
    if (!r.ok) toast(r.error ?? t("That didn't work."), { kind: "err" });
    router.refresh();
  };
  return (
    <div className="stack">
      <div className="list inset">
        {cats.map((c, i) => (
          <div key={c.id} className="list-row">
            <span className="cat-icon" style={{ ["--cc" as string]: c.color, width: 34, height: 34, fontSize: 17 }}>
              {c.icon || c.name.slice(0, 1)}
            </span>
            <span className="grow" style={{ minWidth: 0 }}>
              <b>{c.name}</b> {c.locked ? <Lock size={12} className="muted" /> : null} {c.group ? <span className="badge teal">{c.group.name}</span> : null}
              <span className="tiny muted" style={{ display: "block" }}>
                {t("{threads} threads · {posts} posts", { threads: c.threads, posts: c.posts })}
              </span>
            </span>
            <button type="button" className="icon-btn xs" disabled={!i} onClick={() => run(moveCategoryAction(c.id, -1))} aria-label={t("Up")}>
              <ArrowUp size={14} />
            </button>
            <button type="button" className="icon-btn xs" disabled={i === cats.length - 1} onClick={() => run(moveCategoryAction(c.id, 1))} aria-label={t("Down")}>
              <ArrowDown size={14} />
            </button>
            <button type="button" className="icon-btn xs" onClick={() => setEdit({ id: c.id, name: c.name, description: c.description, color: c.color, icon: c.icon, locked: c.locked, groupId: c.group?.id ?? null })} aria-label={t("Edit")}>
              <Pencil size={14} />
            </button>
            {me?.isAdmin ? (
              <button
                type="button"
                className="icon-btn xs"
                aria-label={t("Delete")}
                onClick={() => {
                  const other = cats.find((x) => x.id !== c.id);
                  confirm(
                    other ? t("Delete {name}? Its {n} threads move to {other}.", { name: c.name, n: c.threads, other: other.name }) : t("Delete {name} and its threads?", { name: c.name }),
                    t("Delete"),
                    () => run(deleteCategoryAction(c.id, other?.id)),
                  );
                }}
              >
                <Trash2 size={14} />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setEdit({ name: "", description: "", color: COLORS[0], icon: "💬", locked: false, groupId: null })}>
        <Plus size={15} /> {t("New category")}
      </button>
      {edit ? (
        <Modal
          title={edit.id ? t("Edit the category") : t("New category")}
          onClose={() => setEdit(null)}
          footer={
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                await run(saveCategoryAction(edit));
                setEdit(null);
              }}
            >
              {t("Save")}
            </button>
          }
        >
          <div className="stack">
            <div className="input-group">
              <input className="input" style={{ maxWidth: 70, textAlign: "center", fontSize: 20 }} value={edit.icon} onChange={(e) => setEdit({ ...edit, icon: e.target.value })} aria-label="Emoji" />
              <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder={t("Name")} maxLength={60} autoFocus />
            </div>
            <input className="input" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} placeholder={t("What goes here")} maxLength={300} />
            <div className="swatches">
              {COLORS.map((c) => (
                <button key={c} type="button" className={`swatch ${edit.color === c ? "on" : ""}`} style={{ background: c, width: 30, height: 30 }} onClick={() => setEdit({ ...edit, color: c })} aria-label={c} />
              ))}
            </div>
            <select className="select" value={edit.groupId ?? ""} onChange={(e) => setEdit({ ...edit, groupId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t("For everyone")}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {t("Only for the group {name}", { name: g.name })}
                </option>
              ))}
            </select>
            <label className="check">
              <input type="checkbox" checked={edit.locked} onChange={(e) => setEdit({ ...edit, locked: e.target.checked })} /> {t("Only moderators start threads (everyone can reply)")}
            </label>
          </div>
        </Modal>
      ) : null}
      {node}
    </div>
  );
}
