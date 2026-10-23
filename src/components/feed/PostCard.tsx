"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock, MessageSquare, Megaphone, Pin } from "lucide-react";
import type { PostView } from "@/lib/contentTypes";
import { useMe, useT, useToast } from "@/components/app/AppProvider";
import { Avatar, ROLE_LABEL, UserLink } from "@/components/ui/Avatar";
import { Time } from "@/components/ui/Time";
import { useConfirm } from "@/components/ui/ui";
import { RichText } from "@/components/content/RichText";
import { Reactions } from "@/components/content/Reactions";
import { Comments } from "@/components/content/Comments";
import { ItemMenu } from "@/components/content/ItemMenu";
import { deletePostAction, lockCommentsAction, pinPostAction, saveAction } from "@/app/actions/content";

export function GroupChip({ g }: { g: { slug: string; name: string; color: string } }) {
  return (
    <Link href={`/groups/${g.slug}`} className="group-chip" style={{ ["--gc" as string]: g.color }}>
      {g.name}
    </Link>
  );
}

/** A post or news item, in the feed or on its own page (`full`). */
export function PostCard({ post, full = false, onGone }: { post: PostView; full?: boolean; onGone?: () => void }) {
  const me = useMe();
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [p, setP] = useState(post);
  const [open, setOpen] = useState(full);
  const [count, setCount] = useState(post.comments);
  const [gone, setGone] = useState(false);
  const { confirm, node } = useConfirm();
  if (gone) return null;
  const news = p.kind === "news";
  return (
    <article className={`panel post-card ${news ? "news" : ""} ${p.pinned ? "pinned" : ""}`} id={`post-${p.id}`}>
      {news && p.cover ? (
        <div className="post-cover" style={{ backgroundImage: `url("${p.cover}")` }} />
      ) : null}
      <header className="post-head">
        <Avatar user={p.author} size={42} presence />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row wrap" style={{ gap: "2px 8px" }}>
            <UserLink user={p.author} />
            {p.author.statusEmoji ? <span title={p.author.statusText}>{p.author.statusEmoji}</span> : null}
            {ROLE_LABEL[p.author.role] && news ? <span className="role-tag">{t(ROLE_LABEL[p.author.role])}</span> : null}
            {p.group ? (
              <>
                <span className="faint small">{t("in")}</span>
                <GroupChip g={p.group} />
              </>
            ) : null}
          </div>
          <div className="tiny muted row" style={{ gap: 6 }}>
            <Link href={`/posts/${p.id}`} className="post-time">
              <Time t={p.createdAt} />
            </Link>
            {p.editedAt ? <span>· {t("edited")}</span> : null}
            {p.visibility === "private" ? (
              <span className="row" style={{ gap: 3 }}>
                · <Lock size={11} /> {t("only you")}
              </span>
            ) : null}
          </div>
        </div>
        {news ? (
          <span className="badge hot">
            <Megaphone size={12} /> {t("News")}
          </span>
        ) : null}
        {p.pinned ? (
          <span className="badge accent" title={t("Pinned")}>
            <Pin size={12} />
          </span>
        ) : null}
        <ItemMenu
          url={`/posts/${p.id}`}
          saved={p.saved}
          onSave={async () => {
            const r = await saveAction("post", p.id);
            if (r.ok) {
              setP({ ...p, saved: r.data });
              toast(t(r.data ? "Saved: find it under Saved." : "Taken out of Saved."));
            }
          }}
          onEdit={p.canEdit || (news && me?.isAdmin) ? () => router.push(`/posts/${p.id}/edit`) : undefined}
          onPin={p.canModerate ? async () => {
            const r = await pinPostAction(p.id, !p.pinned);
            if (r.ok) setP({ ...p, pinned: r.data });
          } : undefined}
          pinned={p.pinned}
          onLock={p.canEdit || p.canModerate ? async () => {
            const r = await lockCommentsAction(p.id, !p.commentsLocked);
            if (r.ok) setP({ ...p, commentsLocked: r.data });
          } : undefined}
          locked={p.commentsLocked}
          onDelete={
            p.canEdit || p.canModerate
              ? () =>
                  confirm(t("Delete this post with its comments? This can't be undone."), t("Delete"), async () => {
                    const r = await deletePostAction(p.id);
                    if (r.ok) {
                      setGone(true);
                      onGone?.();
                      if (full) router.push("/");
                    } else toast(r.error, { kind: "err" });
                  })
              : undefined
          }
          report={p.author.id !== me?.id ? { type: "post", id: p.id } : undefined}
        />
      </header>
      {p.title ? (
        full ? (
          <h1 className={news ? "display post-headline" : "h2 post-title"}>{p.title}</h1>
        ) : (
          <Link href={`/posts/${p.id}`} className={news ? "display post-headline" : "h3 post-title"}>
            {p.title}
          </Link>
        )
      ) : null}
      <div className="post-body">
        <RichText html={p.html} fold={full ? 0 : 560} foldBg="var(--surface)" />
      </div>
      <footer className="post-foot">
        <Reactions type="post" id={p.id} initial={p.reactions} myName={me?.name ?? ""} />
        <span className="spacer" />
        <button type="button" className={`btn btn-ghost btn-sm ${open ? "on" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <MessageSquare size={16} /> {count ? t.n(count, "{n} comment", "{n} comments") : t("Comment{verb}", { verb: "" })}
        </button>
      </footer>
      {open ? <Comments type="post" id={p.id} locked={p.commentsLocked} onCount={setCount} /> : null}
      {node}
    </article>
  );
}
