"use client";

import { useState } from "react";
import { Check, LoaderCircle, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import type { CustomEmoji } from "@/lib/types";
import { Modal, useConfirm } from "@/components/ui/ui";
import { ImagePick } from "@/components/ui/ImagePick";
import { useMe, useSite, useT, useToast } from "@/components/app/AppProvider";
import { addEmojiAction, deleteEmojiAction, renameEmojiAction } from "@/app/actions/emojis";
import { useEmojis } from "./Emojis";

/** what can be typed for a name: "Party Parrot" → "party_parrot" */
function typedName(s: string): string {
  return s
    .toLowerCase()
    .replace(/:/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 32);
}

function NameInput({ value, onChange, onEnter, autoFocus }: { value: string; onChange: (v: string) => void; onEnter?: () => void; autoFocus?: boolean }) {
  const t = useT();
  return (
    <div className="emoji-name">
      <span aria-hidden>:</span>
      <input
        className="input"
        value={value}
        onChange={(e) => onChange(typedName(e.target.value))}
        placeholder="party_parrot"
        aria-label={t("The emoji's name")}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          onEnter?.();
        }}
      />
      <span aria-hidden>:</span>
    </div>
  );
}

/** Add one of the site's own emoji: a picture (a GIF stays animated) and a name to write it with. */
export function AddEmojiDialog({ onClose, onAdded }: { onClose: () => void; onAdded?: (name: string) => void }) {
  const t = useT();
  const toast = useToast();
  const { byName, set } = useEmojis();
  const [url, setUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const taken = byName.has(name);
  const ready = !!url && name.length >= 2 && !taken && !busy;
  const add = async () => {
    if (!ready) return;
    setBusy(true);
    setErr("");
    const r = await addEmojiAction(name, url);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    set(r.data);
    toast(t("Added :{name}:", { name }));
    onAdded?.(name);
    onClose();
  };
  return (
    <Modal
      title={t("Add an emoji")}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className={`btn btn-primary ${busy ? "loading" : ""}`} disabled={!ready} onClick={() => void add()}>
            {busy ? <LoaderCircle size={15} className="spin" /> : <Plus size={15} />} {t("Add")}
          </button>
        </>
      }
    >
      <div className="stack">
        <ImagePick kind="emoji" shape="square" whole value={url} onChange={setUrl} label={t("Picture")} />
        <div className="field">
          <label>{t("Name")}</label>
          <NameInput value={name} onChange={setName} onEnter={() => void add()} />
          <span className="hint">{taken ? t("There's already an emoji called :{name}:.", { name }) : t("Written :{name}: in posts, comments and chat.", { name: name || "name" })}</span>
        </div>
        {url && name.length >= 2 ? (
          <div className="emoji-preview" aria-label={t("Preview")}>
            <span className="small">
              {t("Like this")} <img className="emoji-custom" src={url} alt={`:${name}:`} /> {t("in a sentence,")}
            </span>
            <span className="react-chip mine" aria-hidden>
              <span className="react-emoji">
                <img className="emoji-custom" src={url} alt="" />
              </span>
              <span className="react-n">1</span>
            </span>
            <img className="emoji-custom big" src={url} alt="" />
          </div>
        ) : null}
        <p className="tiny muted" style={{ margin: 0 }}>
          {t("A GIF or animated WebP stays animated. It's made at most 128 pixels; square pictures with a see-through background look best.")}
        </p>
        {err ? <div className="form-error">{err}</div> : null}
      </div>
    </Modal>
  );
}

/** All the site's emoji: who added them, and (theirs, or any for moderators) a new name or away with it. */
export function EmojiManager() {
  const t = useT();
  const me = useMe();
  const site = useSite();
  const toast = useToast();
  const { list, set } = useEmojis();
  const { confirm, node } = useConfirm();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ name: string; next: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = q ? list.filter((e) => e.name.includes(typedName(q))) : list;
  const may = (e: CustomEmoji) => !!me && (e.by === me.id || me.isMod);
  const rename = async () => {
    if (!editing || busy) return;
    if (editing.next === editing.name) return setEditing(null);
    setBusy(true);
    const r = await renameEmojiAction(editing.name, editing.next);
    setBusy(false);
    if (!r.ok) return toast(r.error, { kind: "err" });
    set(r.data);
    setEditing(null);
  };
  return (
    <div className="stack">
      <div className="row wrap" style={{ gap: 8 }}>
        {list.length > 8 ? (
          <label className="emoji-filter grow">
            <Search size={15} />
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search emoji")} aria-label={t("Search emoji")} />
          </label>
        ) : (
          <span className="grow small muted">{t.n(list.length, "{n} emoji", "{n} emoji")}</span>
        )}
        {site.can.emojis ? (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setAdding(true)}>
            <Plus size={15} /> {t("Add an emoji")}
          </button>
        ) : null}
      </div>
      {!list.length ? <p className="small muted" style={{ margin: 0 }}>{site.can.emojis ? t("None yet. Add the first: a picture and a name, and everyone can use it.") : t("None yet.")}</p> : null}
      {list.length && !shown.length ? <p className="small muted" style={{ margin: 0 }}>{t("No emoji found.")}</p> : null}
      <ul className="emoji-list">
        {shown.map((e) => (
          <li key={e.name}>
            <img className="emoji-custom" src={e.url} alt={`:${e.name}:`} />
            {editing?.name === e.name ? (
              <span className="grow row" style={{ gap: 6 }}>
                <NameInput value={editing.next} onChange={(next) => setEditing({ ...editing, next })} onEnter={() => void rename()} autoFocus />
                <button type="button" className="icon-btn sm" disabled={busy || editing.next.length < 2} onClick={() => void rename()} aria-label={t("Save")} title={t("Save")}>
                  <Check size={16} />
                </button>
                <button type="button" className="icon-btn sm" onClick={() => setEditing(null)} aria-label={t("Cancel")} title={t("Cancel")}>
                  <X size={16} />
                </button>
              </span>
            ) : (
              <span className="grow stack tight" style={{ minWidth: 0 }}>
                <b className="ellipsis">:{e.name}:</b>
                <span className="tiny muted ellipsis">
                  {e.byName ? t("Added by {name}", { name: e.byName }) : t("Added by someone who left")}
                  {e.animated ? ` · ${t("Animated")}` : ""}
                </span>
              </span>
            )}
            {may(e) && editing?.name !== e.name ? (
              <span className="row" style={{ gap: 2 }}>
                <button type="button" className="icon-btn sm" onClick={() => setEditing({ name: e.name, next: e.name })} aria-label={t("Rename :{name}:", { name: e.name })} title={t("Rename")}>
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  className="icon-btn sm danger"
                  aria-label={t("Delete :{name}:", { name: e.name })}
                  title={t("Delete")}
                  onClick={() =>
                    confirm(t("Delete :{name}:? It goes from the picker and from reactions; where someone wrote it, it stays.", { name: e.name }), t("Delete"), async () => {
                      const r = await deleteEmojiAction(e.name);
                      if (!r.ok) return toast(r.error, { kind: "err" });
                      set(r.data);
                    })
                  }
                >
                  <Trash2 size={15} />
                </button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {adding ? <AddEmojiDialog onClose={() => setAdding(false)} /> : null}
      {node}
    </div>
  );
}

export function EmojiManagerDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <Modal title={t("The site's emoji")} onClose={onClose}>
      <EmojiManager />
    </Modal>
  );
}
