"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bell, BellOff, ChevronLeft, ChevronRight, FolderInput, Lock, LockOpen, MessageSquareQuote, Pin, PinOff, Reply, Send } from "lucide-react";
import type { ThreadCard } from "@/lib/contentTypes";
import type { ReplyView } from "@/lib/forum";
import { useLive, useMe, useToast } from "@/components/app/AppProvider";
import { Avatar, ROLE_LABEL, UserLink } from "@/components/ui/Avatar";
import { Time } from "@/components/ui/Time";
import { useConfirm, Modal } from "@/components/ui/ui";
import { RichEditor, type EditorHandle } from "@/components/editor/Editor";
import { RichText } from "@/components/content/RichText";
import { Reactions } from "@/components/content/Reactions";
import { ItemMenu } from "@/components/content/ItemMenu";
import { CategoryChip } from "@/components/feed/ThreadCard";
import { deleteReplyAction, deleteThreadAction, editReplyAction, editThreadAction, followAction, moderateThreadAction, quoteAction, replyAction, saveAction } from "@/app/actions/content";

interface Props {
  thread: ThreadCard;
  opening: ReplyView;
  replies: ReplyView[];
  page: number;
  pages: number;
  following: boolean;
  saved: boolean;
  lastRead: number;
  canReply: boolean;
  canModerate: boolean;
  categories: { id: number; name: string; icon: string }[];
}

function ForumPost({ r, threadId, isOpening, onQuote, title, onEdited, newSince }: { r: ReplyView; threadId: number; isOpening: boolean; onQuote: (id: number) => void; title?: string; onEdited: () => void; newSince: number }) {
  const me = useMe();
  const toast = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title ?? "");
  const ed = useRef<EditorHandle>(null);
  const [pending, start] = useTransition();
  const { confirm, node } = useConfirm();
  const anchor = isOpening ? "p-0" : `p-${r.id}`;
  const fresh = !isOpening && r.createdAt > newSince && r.author.id !== me?.id;
  const save = () =>
    start(async () => {
      const html = ed.current?.getHTML() ?? "";
      const res = isOpening ? await editThreadAction(threadId, { title: editTitle, html }) : await editReplyAction(r.id, threadId, html);
      if (!res.ok) toast(res.error, { kind: "err" });
      else {
        setEditing(false);
        onEdited();
      }
    });
  return (
    <article className={`panel forum-post ${fresh ? "fresh" : ""}`} id={anchor}>
      <aside className="fp-author">
        <Avatar user={r.author} size={52} presence />
        <div className="fp-who">
          <UserLink user={r.author} />
          {ROLE_LABEL[r.author.role] ? <span className="role-tag">{ROLE_LABEL[r.author.role]}</span> : null}
          <span className="tiny muted">
            {r.authorPosts} {r.authorPosts === 1 ? "post" : "posts"}
          </span>
        </div>
      </aside>
      <div className="fp-main">
        <div className="fp-head tiny muted">
          <a href={`#${anchor}`}>
            <Time t={r.createdAt} mode="datetime" />
          </a>
          {r.editedAt ? <span>· edited</span> : null}
          {fresh ? <span className="badge hot">New</span> : null}
          <span className="spacer" />
          <ItemMenu
            url={isOpening ? `/forum/t/${threadId}` : `/go/reply/${r.id}`}
            onEdit={r.canEdit || (isOpening && me?.isMod) ? () => setEditing(true) : undefined}
            onDelete={
              r.canDelete
                ? () =>
                    confirm(isOpening ? "Delete the whole thread with every reply?" : "Delete this reply?", "Delete", async () => {
                      const res = isOpening ? await deleteThreadAction(threadId) : await deleteReplyAction(r.id, threadId);
                      if (!res.ok) toast(res.error, { kind: "err" });
                      else if (isOpening) router.push("/forum");
                      else onEdited();
                    })
                : undefined
            }
            report={r.author.id !== me?.id ? { type: isOpening ? "thread" : "reply", id: isOpening ? threadId : r.id } : undefined}
          />
        </div>
        {editing ? (
          <div className="stack">
            {isOpening ? <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={160} /> : null}
            <RichEditor ref={ed} initial={r.html} minHeight={160} onSubmit={save} autoFocus />
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button type="button" className={`btn btn-primary btn-sm ${pending ? "loading" : ""}`} onClick={save}>
                Save
              </button>
            </div>
          </div>
        ) : (
          <RichText html={r.html} />
        )}
        <div className="fp-foot">
          <Reactions type={isOpening ? "thread" : "reply"} id={isOpening ? threadId : r.id} initial={r.reactions} myName={me?.name ?? ""} small />
          <span className="spacer" />
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => onQuote(isOpening ? 0 : r.id)}>
            <MessageSquareQuote size={14} /> Quote
          </button>
        </div>
      </div>
      {node}
    </article>
  );
}

export function ThreadView(p: Props) {
  const me = useMe();
  const toast = useToast();
  const router = useRouter();
  const box = useRef<EditorHandle>(null);
  const boxWrap = useRef<HTMLDivElement>(null);
  const [following, setFollowing] = useState(p.following);
  const [saved, setSaved] = useState(p.saved);
  const [moving, setMoving] = useState(false);
  const [newReplies, setNewReplies] = useState(0);
  const [pending, start] = useTransition();
  const t = p.thread;

  useLive("thread", (d) => {
    const e = d as { id: number; by: number };
    if (e.id === t.id && e.by !== me?.id) setNewReplies((n) => n + 1);
  });
  // a link to a reply scrolls to it once the page is drawn
  useEffect(() => {
    if (window.location.hash) document.querySelector(window.location.hash)?.scrollIntoView({ block: "center" });
  }, []);

  const quote = async (replyId: number) => {
    const r = await quoteAction(t.id, replyId);
    if (r.ok && r.data && box.current) {
      const cur = box.current.getHTML();
      box.current.setHTML(cur + r.data);
      boxWrap.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => box.current?.focus(), 300);
    }
  };
  const send = () => {
    if (box.current?.busy()) {
      toast("Wait for the pictures to finish uploading.");
      return;
    }
    start(async () => {
      const r = await replyAction(t.id, box.current?.getHTML() ?? "");
      if (!r.ok) {
        toast(r.error, { kind: "err" });
        return;
      }
      box.current?.clear();
      setFollowing(true);
      router.push(`/go/reply/${r.data}`);
      router.refresh();
    });
  };
  const mod = async (o: { pinned?: boolean; locked?: boolean; categoryId?: number }) => {
    const r = await moderateThreadAction(t.id, o);
    if (!r.ok) toast(r.error, { kind: "err" });
    else router.refresh();
  };
  const pageLink = (n: number) => `/forum/t/${t.id}${n > 1 ? `?page=${n}` : ""}`;
  const pager =
    p.pages > 1 ? (
      <nav className="pager" aria-label="Pages">
        {p.page > 1 ? (
          <Link href={pageLink(p.page - 1)} className="btn btn-sm">
            <ChevronLeft size={15} /> Back
          </Link>
        ) : (
          <span />
        )}
        <span className="pager-nums">
          {Array.from({ length: p.pages }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === p.pages || Math.abs(n - p.page) <= 2)
            .map((n, i, arr) => (
              <span key={n} className="row" style={{ gap: 4 }}>
                {i && n - arr[i - 1] > 1 ? <span className="faint">…</span> : null}
                <Link href={pageLink(n)} className={`pill ${n === p.page ? "active" : ""}`}>
                  {n}
                </Link>
              </span>
            ))}
        </span>
        {p.page < p.pages ? (
          <Link href={pageLink(p.page + 1)} className="btn btn-sm">
            Next <ChevronRight size={15} />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    ) : null;

  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 6 }}>
        <div style={{ minWidth: 0 }}>
          <div className="row wrap" style={{ gap: 8, marginBottom: 10 }}>
            <CategoryChip c={t.category} />
            {t.pinned ? (
              <span className="badge accent">
                <Pin size={11} /> Pinned
              </span>
            ) : null}
            {t.locked ? (
              <span className="badge danger">
                <Lock size={11} /> Locked
              </span>
            ) : null}
          </div>
          <h1 className="h2 thread-h1">{t.title}</h1>
          <div className="small muted" style={{ marginTop: 6 }}>
            {t.replies} {t.replies === 1 ? "reply" : "replies"} · {t.views} views · started <Time t={t.createdAt} />
          </div>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className={`btn btn-sm ${following ? "btn-secondary" : ""}`}
            onClick={async () => {
              const r = await followAction(t.id, !following);
              if (r.ok) {
                setFollowing(r.data);
                toast(r.data ? "You'll hear about new replies." : "No more notifications from this thread.");
              }
            }}
          >
            {following ? <Bell size={15} /> : <BellOff size={15} />} {following ? "Following" : "Follow"}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={async () => {
              const r = await saveAction("thread", t.id);
              if (r.ok) setSaved(r.data);
            }}
          >
            {saved ? "Saved" : "Save"}
          </button>
          {p.canModerate ? (
            <>
              <button type="button" className="btn btn-sm" onClick={() => mod({ pinned: !t.pinned })}>
                {t.pinned ? <PinOff size={15} /> : <Pin size={15} />} {t.pinned ? "Unpin" : "Pin"}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => mod({ locked: !t.locked })}>
                {t.locked ? <LockOpen size={15} /> : <Lock size={15} />} {t.locked ? "Unlock" : "Lock"}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setMoving(true)}>
                <FolderInput size={15} /> Move
              </button>
            </>
          ) : null}
        </div>
      </div>
      {pager}
      {p.page === 1 ? <ForumPost r={p.opening} threadId={t.id} isOpening onQuote={quote} title={t.title} onEdited={() => router.refresh()} newSince={p.lastRead} /> : null}
      {p.replies.map((r) => (
        <ForumPost key={r.id} r={r} threadId={t.id} isOpening={false} onQuote={quote} onEdited={() => router.refresh()} newSince={p.lastRead} />
      ))}
      {newReplies ? (
        <button
          type="button"
          className="fresh-pill"
          style={{ position: "static" }}
          onClick={() => {
            setNewReplies(0);
            router.push(pageLink(p.pages));
            router.refresh();
          }}
        >
          {newReplies} new {newReplies === 1 ? "reply" : "replies"}: show
        </button>
      ) : null}
      {pager}
      {p.canReply ? (
        <div className="panel panel-pad" ref={boxWrap}>
          <div className="row" style={{ marginBottom: 10 }}>
            <Reply size={17} className="muted" />
            <b>Reply</b>
            {t.locked ? <span className="badge danger">Locked: moderators only</span> : null}
          </div>
          <RichEditor ref={box} placeholder="Write a reply… (select text in a post and press Quote to quote it)" minHeight={130} draftKey={`reply-${t.id}`} onSubmit={send} />
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
            <button type="button" className={`btn btn-primary ${pending ? "loading" : ""}`} onClick={send}>
              <Send size={16} /> Post reply
            </button>
          </div>
        </div>
      ) : (
        <div className="panel panel-pad small muted row">
          <Lock size={16} /> This thread is locked.
        </div>
      )}
      {moving ? (
        <Modal title="Move to…" onClose={() => setMoving(false)}>
          <div className="stack tight">
            {p.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`menu-item ${c.id === t.category.id ? "sel" : ""}`}
                onClick={async () => {
                  setMoving(false);
                  await mod({ categoryId: c.id });
                }}
              >
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
