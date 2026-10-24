"use client";

import { useRef, useState } from "react";
import { Copy, CornerUpLeft, Ellipsis, Flag, Pencil, Pin, PinOff, SmilePlus, Trash2 } from "lucide-react";
import type { ChatMessage } from "@/lib/chatTypes";
import type { UserSummary } from "@/lib/types";
import { useT } from "@/components/app/AppProvider";
import { Avatar, ROLE_LABEL } from "@/components/ui/Avatar";
import { timeLabel, fullLabel } from "@/components/ui/Time";
import { Dropdown, Modal } from "@/components/ui/ui";
import { EmojiPopover, QUICK_REACTIONS } from "@/components/ui/EmojiPicker";
import { RichText } from "@/components/content/RichText";
import { RichEditor, type EditorHandle } from "@/components/editor/Editor";

/** the reactions chat suggests: the usual ones without 😂 (the picker still has every emoji) */
const CHAT_REACTIONS = QUICK_REACTIONS.filter((e) => e !== "😂");

export interface MessageHandlers {
  onReply: (m: ChatMessage) => void;
  onReact: (m: ChatMessage, emoji: string) => void;
  onEdit: (m: ChatMessage, html: string) => Promise<boolean>;
  onDelete: (m: ChatMessage) => void;
  onPin: (m: ChatMessage) => void;
  onReport: (m: ChatMessage) => void;
  onJump: (id: number) => void;
}

export function Message({ m, me, compact, canModerate, readers, seen, highlight, h }: { m: ChatMessage; me: UserSummary; compact: boolean; canModerate: boolean; readers: UserSummary[]; seen: boolean; highlight: boolean; h: MessageHandlers }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [picker, setPicker] = useState(false);
  const reactBtn = useRef<HTMLButtonElement>(null);
  const ed = useRef<EditorHandle>(null);
  const press = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mine = m.author?.id === me.id;

  if (m.kind === "system")
    return (
      <div className="msg-system" id={`m-${m.id}`}>
        <span>{m.html.replace(/<[^>]+>/g, "")}</span> <span className="faint">· {timeLabel(m.createdAt)}</span>
      </div>
    );

  const actions = [
    { icon: CornerUpLeft, label: t("Reply"), run: () => h.onReply(m), show: !m.deleted },
    { icon: Pencil, label: t("Edit"), run: () => setEditing(true), show: mine && !m.deleted },
    { icon: m.pinned ? PinOff : Pin, label: m.pinned ? t("Unpin") : t("Pin"), run: () => h.onPin(m), show: !m.deleted },
    { icon: Copy, label: t("Copy text"), run: () => void navigator.clipboard?.writeText(m.html.replace(/<br\s*\/?>/g, "\n").replace(/<\/p>/g, "\n").replace(/<[^>]+>/g, "").trim()), show: !m.deleted },
    { icon: Flag, label: t("Report"), run: () => h.onReport(m), show: !mine && !m.deleted },
    { icon: Trash2, label: t("Delete"), run: () => h.onDelete(m), show: (mine || canModerate) && !m.deleted, danger: true },
  ].filter((a) => a.show);

  const startPress = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("a,button,.react-chip")) return;
    press.current = setTimeout(() => {
      setSheet(true);
      navigator.vibrate?.(10);
    }, 450);
  };
  const endPress = () => clearTimeout(press.current);

  return (
    <div
      className={`msg ${compact ? "compact" : ""} ${mine ? "mine" : ""} ${highlight ? "hl" : ""} ${m.pinned ? "pinned" : ""}`}
      id={`m-${m.id}`}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onTouchMove={endPress}
      onContextMenu={(e) => {
        if (window.matchMedia("(pointer: coarse)").matches) e.preventDefault();
      }}
    >
      <div className="msg-gutter">{compact ? <span className="msg-time-hover">{timeLabel(m.createdAt)}</span> : m.author ? <Avatar user={m.author} size={38} presence /> : null}</div>
      <div className="msg-main">
        {!compact && m.author ? (
          <div className="msg-head">
            <b className="msg-name" style={{ color: m.author.accent }}>
              {m.author.name}
            </b>
            {ROLE_LABEL[m.author.role] ? <span className="role-tag">{t(ROLE_LABEL[m.author.role])}</span> : null}
            <span className="tiny faint" title={fullLabel(m.createdAt)}>
              {timeLabel(m.createdAt)}
            </span>
            {m.pinned ? <Pin size={12} className="faint" /> : null}
          </div>
        ) : null}
        {m.replyTo ? (
          <button type="button" className="msg-reply" onClick={() => h.onJump(m.replyTo!.id)}>
            <CornerUpLeft size={12} /> <b>{m.replyTo.author || t("Someone")}</b> <span className="ellipsis">{m.replyTo.deleted ? t("(deleted)") : m.replyTo.text}</span>
          </button>
        ) : null}
        {m.deleted ? (
          <div className="msg-deleted">{t("Message deleted")}</div>
        ) : editing ? (
          <div className="msg-edit">
            <RichEditor
              ref={ed}
              variant="compact"
              initial={m.html}
              autoFocus
              enterSends
              onSubmit={async () => {
                if (await h.onEdit(m, ed.current?.getHTML() ?? "")) setEditing(false);
              }}
              actions={
                <>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditing(false)}>
                    {t("Cancel")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-xs"
                    onClick={async () => {
                      if (await h.onEdit(m, ed.current?.getHTML() ?? "")) setEditing(false);
                    }}
                  >
                    {t("Save")}
                  </button>
                </>
              }
            />
          </div>
        ) : (
          <div className="msg-body">
            <RichText html={m.html} />
            {m.editedAt ? <span className="tiny faint msg-edited">{t("(edited)")}</span> : null}
          </div>
        )}
        {m.reactions.length ? (
          <div className="reactions small msg-reacts">
            {m.reactions.map((r) => (
              <button key={r.emoji} type="button" className={`react-chip ${r.mine ? "mine" : ""}`} onClick={() => h.onReact(m, r.emoji)} title={r.users.join(", ")}>
                <span className="react-emoji">{r.emoji}</span>
                <span className="react-n">{r.count}</span>
              </button>
            ))}
          </div>
        ) : null}
        {seen || readers.length ? (
          <div className="msg-readers">
            {seen ? <span className="tiny faint">{t("Seen")}</span> : null}
            {readers.slice(0, 8).map((u) => (
              <span key={u.id} title={t("{name} has read up to here", { name: u.name })}>
                <Avatar user={u} size={16} />
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {!m.deleted && !editing ? (
        <div className="msg-tools">
          {CHAT_REACTIONS.slice(0, 2).map((e) => (
            <button key={e} type="button" className="msg-tool emoji" onClick={() => h.onReact(m, e)} aria-label={t("React {emoji}", { emoji: e })}>
              {e}
            </button>
          ))}
          <button ref={reactBtn} type="button" className="msg-tool" onClick={() => setPicker(true)} aria-label={t("More reactions")} title={t("React")}>
            <SmilePlus size={16} />
          </button>
          <button type="button" className="msg-tool" onClick={() => h.onReply(m)} aria-label={t("Reply")} title={t("Reply")}>
            <CornerUpLeft size={16} />
          </button>
          <Dropdown label={t("More")} className="msg-tool" button={<Ellipsis size={16} />}>
            {actions.map((a) => (
              <button key={a.label} type="button" className={`menu-item ${a.danger ? "danger" : ""}`} data-close onClick={a.run}>
                <a.icon size={16} /> {a.label}
              </button>
            ))}
          </Dropdown>
        </div>
      ) : null}
      {picker ? (
        <EmojiPopover
          anchor={reactBtn.current}
          onPick={(e) => {
            setPicker(false);
            h.onReact(m, e);
          }}
          onClose={() => setPicker(false)}
        />
      ) : null}
      {sheet ? (
        <Modal onClose={() => setSheet(false)} label={t("Message")}>
          <div className="quick-reacts" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            {CHAT_REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setSheet(false);
                  h.onReact(m, e);
                }}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="stack" style={{ gap: 2 }}>
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                className={`menu-item ${a.danger ? "danger" : ""}`}
                style={{ padding: "13px 12px", fontSize: "1rem" }}
                onClick={() => {
                  setSheet(false);
                  a.run();
                }}
              >
                <a.icon size={19} /> {a.label}
              </button>
            ))}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
