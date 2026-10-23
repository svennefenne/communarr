"use client";

import { useRef, useState, useTransition } from "react";
import { Globe, Lock, Smile } from "lucide-react";
import type { RoomInfo } from "@/lib/chatTypes";
import { useT, useToast } from "@/components/app/AppProvider";
import { Modal } from "@/components/ui/ui";
import { EmojiPopover } from "@/components/ui/EmojiPicker";
import { roomInfoAction, updateRoomAction } from "@/app/actions/chat";

/** A room's name, topic, emoji and who can get in (the owner and the room's admins). */
export function RoomSettings({ info, canManage, onClose, onSaved }: { info: RoomInfo; canManage: boolean; onClose: () => void; onSaved: (i: RoomInfo) => void }) {
  const t = useT();
  const toast = useToast();
  const [name, setName] = useState(info.name);
  const [topic, setTopic] = useState(info.topic);
  const [emoji, setEmoji] = useState(info.emoji);
  const [visibility, setVisibility] = useState(info.visibility);
  const [picker, setPicker] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const [pending, start] = useTransition();
  if (!canManage)
    return (
      <Modal title={info.name} onClose={onClose}>
        <div className="stack small">
          {info.topic ? <p style={{ margin: 0 }}>{info.topic}</p> : null}
          <span className="muted">
            {info.visibility === "open" ? t("Open: everyone can join.") : t("Private: by invitation.")} {t.n(info.memberCount, "{n} member", "{n} members")}.
          </span>
          {info.groupSlug ? <span className="muted">{t("The chat room of a group: its members are the group's.")}</span> : null}
        </div>
      </Modal>
    );
  return (
    <Modal
      title={t("Room settings")}
      onClose={onClose}
      footer={
        <button
          type="button"
          className={`btn btn-primary ${pending ? "loading" : ""}`}
          onClick={() =>
            start(async () => {
              const r = await updateRoomAction(info.id, { name, topic, emoji, visibility: info.kind === "room" ? visibility : undefined });
              if (!r.ok) {
                toast(r.error, { kind: "err" });
                return;
              }
              const i = await roomInfoAction(info.id);
              if (i.ok) onSaved(i.data);
              onClose();
            })
          }
        >
          {t("Save")}
        </button>
      }
    >
      <div className="stack">
        <div className="input-group">
          <button ref={btn} type="button" className="icon-btn framed" style={{ width: 46, height: 46, fontSize: 22 }} onClick={() => setPicker((p) => !p)} aria-label={t("Room emoji")}>
            {emoji || <Smile size={20} />}
          </button>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} disabled={!!info.groupSlug} />
        </div>
        {picker ? (
          <EmojiPopover
            anchor={btn.current}
            onPick={(e) => {
              setEmoji(e);
              setPicker(false);
            }}
            onClose={() => setPicker(false)}
          />
        ) : null}
        {emoji ? (
          <button type="button" className="btn btn-ghost btn-xs" style={{ alignSelf: "flex-start" }} onClick={() => setEmoji("")}>
            {t("No emoji")}
          </button>
        ) : null}
        <div className="field">
          <label htmlFor="rs-topic">{t("Topic")}</label>
          <input id="rs-topic" className="input" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} placeholder={t("What's it for?")} />
        </div>
        {info.kind === "room" ? (
          <div className="privacy-pick" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <button type="button" className={`privacy-opt ${visibility === "open" ? "on" : ""}`} onClick={() => setVisibility("open")}>
              <Globe size={20} />
              <b>{t("Open")}</b>
              <span className="tiny muted">{t("Everyone can see it and join.")}</span>
            </button>
            <button type="button" className={`privacy-opt ${visibility === "private" ? "on" : ""}`} onClick={() => setVisibility("private")}>
              <Lock size={20} />
              <b>{t("Private")}</b>
              <span className="tiny muted">{t("Only people invited.")}</span>
            </button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
