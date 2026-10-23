"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import type { UserSummary } from "@/lib/types";
import { loadMembers } from "@/components/editor/mention";
import { Avatar } from "./Avatar";
import { Modal } from "./ui";
import { useT } from "@/components/app/AppProvider";

/** Pick people (to invite somewhere): search, tick, done. `exclude`: already in. */
export function PeoplePicker({ title, exclude = [], onDone, onClose, confirm }: { title: string; exclude?: number[]; onDone: (ids: number[]) => void | Promise<void>; onClose: () => void; confirm?: string }) {
  const t = useT();
  const [all, setAll] = useState<UserSummary[] | null>(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    loadMembers().then(setAll);
  }, []);
  const ex = useMemo(() => new Set(exclude), [exclude]);
  const list = (all ?? []).filter((u) => !ex.has(u.id) && (!q || u.name.toLowerCase().includes(q.toLowerCase()) || u.username.toLowerCase().includes(q.toLowerCase())));
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const chosen = (all ?? []).filter((u) => picked.includes(u.id));
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button
            type="button"
            className={`btn btn-primary ${busy ? "loading" : ""}`}
            disabled={!picked.length}
            onClick={async () => {
              setBusy(true);
              await onDone(picked);
              setBusy(false);
            }}
          >
            {confirm ?? t("Invite{verb}", { verb: "" })}
            {picked.length ? ` (${picked.length})` : ""}
          </button>
        </>
      }
    >
      <div className="stack">
        {chosen.length ? (
          <div className="chip-row" style={{ flexWrap: "wrap" }}>
            {chosen.map((u) => (
              <button key={u.id} type="button" className="pill soft" onClick={() => toggle(u.id)}>
                <Avatar user={u} size={18} /> {u.name} <X size={12} />
              </button>
            ))}
          </div>
        ) : null}
        <div className="search-bar inset" style={{ borderRadius: 12, padding: "8px 12px" }}>
          <Search size={17} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Find people")} autoFocus style={{ fontSize: "1rem" }} />
        </div>
        <div className="list inset picker-list">
          {!all ? <div className="panel-body small muted" style={{ paddingTop: 12 }}>{t("Loading…")}</div> : null}
          {all && !list.length ? <div className="panel-body small muted" style={{ paddingTop: 12 }}>{t("Nobody to add.")}</div> : null}
          {list.map((u) => (
            <button key={u.id} type="button" className={`list-row ${picked.includes(u.id) ? "unread" : ""}`} onClick={() => toggle(u.id)}>
              <Avatar user={u} size={32} presence />
              <span className="grow" style={{ minWidth: 0 }}>
                <b className="ellipsis" style={{ display: "block" }}>
                  {u.name}
                </b>
                <span className="tiny muted">@{u.username}</span>
              </span>
              <span className={`pick-box ${picked.includes(u.id) ? "on" : ""}`}>{picked.includes(u.id) ? <Check size={14} strokeWidth={3} /> : null}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
