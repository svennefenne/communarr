"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CornerDownRight, Send } from "lucide-react";
import type { CommentView } from "@/lib/contentTypes";
import type { CommentTarget } from "@/lib/comments";
import { useLive, useMe, useT, useToast } from "@/components/app/AppProvider";
import { Avatar, UserLink } from "@/components/ui/Avatar";
import { Time } from "@/components/ui/Time";
import { useConfirm } from "@/components/ui/ui";
import { RichEditor, type EditorHandle } from "@/components/editor/Editor";
import { RichText } from "./RichText";
import { Reactions } from "./Reactions";
import { ItemMenu } from "./ItemMenu";
import { addCommentAction, commentsAction, deleteCommentAction, editCommentAction } from "@/app/actions/content";

function CommentBox({ placeholder, onSend, autoFocus, draftKey, initial, onCancel, sendLabel }: { placeholder: string; onSend: (html: string) => Promise<boolean>; autoFocus?: boolean; draftKey?: string; initial?: string; onCancel?: () => void; sendLabel?: string }) {
  const t = useT();
  const ed = useRef<EditorHandle>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const html = ed.current?.getHTML() ?? "";
    if (!html || busy) return;
    if (ed.current?.busy()) return;
    setBusy(true);
    const ok = await onSend(html);
    setBusy(false);
    if (ok) ed.current?.clear();
  };
  return (
    <RichEditor
      ref={ed}
      variant="compact"
      placeholder={placeholder}
      autoFocus={autoFocus}
      draftKey={draftKey}
      initial={initial}
      onSubmit={send}
      actions={
        <>
          {onCancel ? (
            <button type="button" className="btn btn-ghost btn-xs" onClick={onCancel}>
              {t("Cancel")}
            </button>
          ) : null}
          <button type="button" className={`btn btn-primary btn-xs ${busy ? "loading" : ""}`} onClick={send} title={t("Send (Ctrl+Enter)")}>
            <Send size={13} /> {sendLabel ?? t("Send")}
          </button>
        </>
      }
    />
  );
}

function Comment({ c, type, id, onChanged, onReply, replyTo, depth }: { c: CommentView; type: CommentTarget; id: number; onChanged: () => void; onReply: (c: CommentView) => void; replyTo: number | null; depth: number }) {
  const me = useMe();
  const t = useT();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const { confirm, node } = useConfirm();
  return (
    <div className={`comment ${depth ? "reply" : ""}`} id={`c-${c.id}`}>
      <Avatar user={c.author} size={depth ? 28 : 34} presence />
      <div className="comment-main">
        <div className="comment-bubble">
          <div className="comment-head">
            <UserLink user={c.author} />
            <span className="tiny faint">
              <Time t={c.createdAt} />
              {c.editedAt ? ` · ${t("edited")}` : ""}
            </span>
            <span className="spacer" />
            <ItemMenu
              url={`#c-${c.id}`}
              onEdit={c.canEdit ? () => setEditing(true) : undefined}
              onDelete={
                c.canDelete
                  ? () =>
                      confirm(t("Delete this comment (and the answers to it)?"), t("Delete"), async () => {
                        const r = await deleteCommentAction(c.id);
                        if (r.ok) onChanged();
                        else toast(r.error, { kind: "err" });
                      })
                  : undefined
              }
              report={c.author.id !== me?.id ? { type: "comment", id: c.id } : undefined}
            />
          </div>
          {editing ? (
            <CommentBox
              placeholder={t("Edit your comment")}
              initial={c.html}
              autoFocus
              sendLabel={t("Save")}
              onCancel={() => setEditing(false)}
              onSend={async (html) => {
                const r = await editCommentAction(c.id, html);
                if (!r.ok) {
                  toast(r.error, { kind: "err" });
                  return false;
                }
                setEditing(false);
                onChanged();
                return true;
              }}
            />
          ) : (
            <RichText html={c.html} />
          )}
        </div>
        <div className="comment-actions">
          <Reactions type="comment" id={c.id} initial={c.reactions} myName={me?.name ?? ""} small />
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => onReply(c)}>
            <CornerDownRight size={13} /> {t("Reply")}
          </button>
        </div>
        {c.replies.map((r) => (
          <Comment key={r.id} c={r} type={type} id={id} onChanged={onChanged} onReply={() => onReply(c)} replyTo={replyTo} depth={1} />
        ))}
        {replyTo === c.id ? (
          <div className="comment reply">
            <Avatar user={me!} size={28} />
            <div className="comment-main">
              <CommentBox
                placeholder={t("Answer {name}…", { name: c.author.name })}
                autoFocus
                draftKey={`c-${type}-${id}-${c.id}`}
                onCancel={() => onReply({ ...c, id: -1 })}
                onSend={async (html) => {
                  const r = await addCommentAction(type, id, html, c.id);
                  if (!r.ok) {
                    toast(r.error, { kind: "err" });
                    return false;
                  }
                  onReply({ ...c, id: -1 });
                  onChanged();
                  return true;
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
      {node}
    </div>
  );
}

/** Comments under a post, poll or event: the list, answers one level in, and a box to write. */
export function Comments({ type, id, initial, locked = false, onCount }: { type: CommentTarget; id: number; initial?: CommentView[]; locked?: boolean; onCount?: (n: number) => void }) {
  const me = useMe();
  const t = useT();
  const toast = useToast();
  const [list, setList] = useState<CommentView[] | null>(initial ?? null);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const load = useCallback(async () => {
    const r = await commentsAction(type, id);
    if (r.ok) {
      setList(r.data);
      onCount?.(r.data.reduce((n, c) => n + 1 + c.replies.length, 0));
    }
  }, [type, id, onCount]);
  useEffect(() => {
    if (!initial) void load();
  }, [initial, load]);
  useLive("comment", (d) => {
    const e = d as { type: string; id: number; by: number };
    if (e.type === type && e.id === id && e.by !== me?.id) void load();
  });
  if (!me) return null;
  return (
    <div className="comments">
      {list === null ? <div className="skeleton" style={{ height: 50 }} /> : null}
      {list?.map((c) => (
        <Comment key={c.id} c={c} type={type} id={id} onChanged={load} onReply={(x) => setReplyTo(x.id === -1 ? null : x.id)} replyTo={replyTo} depth={0} />
      ))}
      {locked ? (
        <p className="small muted">{t("Comments are closed.")}</p>
      ) : (
        <div className="comment">
          <Avatar user={me} size={34} />
          <div className="comment-main">
            <CommentBox
              placeholder={t(list?.length ? "Write a comment…" : "Be the first to comment…")}
              draftKey={`c-${type}-${id}`}
              onSend={async (html) => {
                const r = await addCommentAction(type, id, html);
                if (!r.ok) {
                  toast(r.error, { kind: "err" });
                  return false;
                }
                await load();
                return true;
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
