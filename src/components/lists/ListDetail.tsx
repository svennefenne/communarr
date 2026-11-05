"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ListChecks, Lock, MessageSquare, Pencil, Trash2 } from "lucide-react";
import type { ListView } from "@/lib/contentTypes";
import { useMe, useT, useToast } from "@/components/app/AppProvider";
import { UserLink } from "@/components/ui/Avatar";
import { Time } from "@/components/ui/Time";
import { useConfirm } from "@/components/ui/ui";
import { RichText } from "@/components/content/RichText";
import { Reactions } from "@/components/content/Reactions";
import { Comments } from "@/components/content/Comments";
import { GroupChip } from "@/components/feed/PostCard";
import { deleteListAction } from "@/app/actions/lists";
import { ListTable, useListView } from "./ListTable";

/**
 * A list on its own page: what it's for, its table (filled in right there, live as others fill it in
 * too), and talk about it. "Big list" (?view=big) shows the table alone, filling the screen under the
 * site's top bar; Back (or the phone's back) leaves it.
 */
export function ListDetail({ list: initial }: { list: ListView }) {
  const t = useT();
  const me = useMe();
  const toast = useToast();
  const router = useRouter();
  const { confirm, node } = useConfirm();
  const { l, setL, refresh } = useListView(initial, () => router.push("/lists"));
  const [comments, setComments] = useState(initial.comments);
  const filledCount = l.rowList.filter((r) => Object.keys(r.cells).length).length;

  const path = usePathname();
  const big = useSearchParams().get("view") === "big";
  // (opened here: Back goes back in history, so the phone's back does the same; opened from a link: Back just leaves it)
  const opened = useRef(false);
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (big) back.current?.focus();
  }, [big]);
  const openBig = () => {
    opened.current = true;
    window.history.pushState(null, "", `${path}?view=big`);
  };
  const closeBig = () => {
    if (opened.current) {
      opened.current = false;
      window.history.back();
    } else window.history.replaceState(null, "", path);
  };

  if (big)
    return (
      <section className="list-big" aria-label={l.title}>
        <div className="list-big-bar">
          <button ref={back} type="button" className="back-pill" onClick={closeBig}>
            <ChevronLeft size={15} /> {t("Back")}
          </button>
          <h1 className="list-big-title">{l.title}</h1>
        </div>
        <ListTable l={l} setL={setL} refresh={refresh} big />
      </section>
    );

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
          {l.autoRows ? t.n(filledCount, "{n} row filled in", "{n} rows filled in") : t("{n} of {total} rows filled in", { n: filledCount, total: l.rowList.length })}
          {" · "}
          {l.fill === "owner" ? t("Only {name} fills it in", { name: l.author.name }) : l.ownRows ? t("Everyone can contribute to the list - you can edit your rows") : t("Everyone fills it in")}
        </p>
      </article>
      <ListTable l={l} setL={setL} refresh={refresh} onBig={openBig} />
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
