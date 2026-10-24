"use client";

import { CardSection } from "./CardSection";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Clock, EyeOff, Lock, MessageSquare, Plus, RotateCcw, Vote } from "lucide-react";
import type { PollView } from "@/lib/contentTypes";
import { useLive, useMe, useT, useToast } from "@/components/app/AppProvider";
import { Avatar, UserLink } from "@/components/ui/Avatar";
import { relative, Time } from "@/components/ui/Time";
import { useConfirm } from "@/components/ui/ui";
import { RichText } from "@/components/content/RichText";
import { Reactions } from "@/components/content/Reactions";
import { Comments } from "@/components/content/Comments";
import { ItemMenu } from "@/components/content/ItemMenu";
import { GroupChip } from "./PostCard";
import { addOptionAction, closePollAction, deletePollAction, pollAction, saveAction, voteAction } from "@/app/actions/content";

/** A poll: vote right here, see how it's going, and talk about it. */
export function PollCard({ poll, full = false, section = false }: { poll: PollView; full?: boolean; section?: boolean }) {
  const me = useMe();
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [p, setP] = useState(poll);
  const [picked, setPicked] = useState<number[]>(poll.options.filter((o) => o.mine).map((o) => o.id));
  const [changing, setChanging] = useState(false);
  const [adding, setAdding] = useState("");
  const [open, setOpen] = useState(full);
  const [count, setCount] = useState(poll.comments);
  const [gone, setGone] = useState(false);
  const [pending, start] = useTransition();
  const { confirm, node } = useConfirm();

  useLive("poll", (d) => {
    if ((d as { id: number }).id === p.id)
      void pollAction(p.id).then((r) => {
        if (r.ok && r.data) setP(r.data);
      });
  });
  if (gone) return null;

  const voting = !p.closed && (!p.voted || changing);
  const total = p.options.reduce((n, o) => n + o.votes, 0);
  const max = Math.max(1, ...p.options.map((o) => o.votes));
  const submit = (ids: number[]) =>
    start(async () => {
      const r = await voteAction(p.id, ids);
      if (r.ok && r.data) {
        setP(r.data);
        setChanging(false);
      } else if (!r.ok) toast(r.error, { kind: "err" });
    });
  const toggle = (id: number) => {
    if (!p.multiple) {
      setPicked([id]);
      submit([id]);
      return;
    }
    setPicked((x) => (x.includes(id) ? x.filter((y) => y !== id) : p.maxChoices && x.length >= p.maxChoices ? x : [...x, id]));
  };

  return (
    <article className="panel poll-card" id={`poll-${p.id}`}>
      {section ? <CardSection kind="poll" /> : null}
      <header className="post-head">
        <span className="kind-icon poll">
          <Vote size={20} />
        </span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row wrap" style={{ gap: "2px 8px" }}>
            <span className="small muted">{t("Poll by")}</span> <UserLink user={p.author} />
            {p.group ? <GroupChip g={p.group} /> : null}
          </div>
          <div className="tiny muted">
            <Time t={p.createdAt} />
          </div>
        </div>
        <ItemMenu
          url={`/polls/${p.id}`}
          onSave={async () => {
            const r = await saveAction("poll", p.id);
            if (r.ok) toast(t(r.data ? "Saved." : "Taken out of Saved."));
          }}
          onEdit={p.canEdit ? () => router.push(`/polls/${p.id}/edit`) : undefined}
          extra={
            p.canEdit ? (
              <button
                type="button"
                className="menu-item"
                data-close
                onClick={async () => {
                  const r = await closePollAction(p.id, !p.closed);
                  if (r.ok && r.data) setP(r.data);
                }}
              >
                {p.closed ? <RotateCcw size={16} /> : <Lock size={16} />} {t(p.closed ? "Open the poll again" : "Close the poll now")}
              </button>
            ) : null
          }
          onDelete={
            p.canEdit
              ? () =>
                  confirm(t("Delete this poll with its votes and comments?"), t("Delete"), async () => {
                    const r = await deletePollAction(p.id);
                    if (r.ok) {
                      setGone(true);
                      if (full) router.push("/polls");
                    } else toast(r.error, { kind: "err" });
                  })
              : undefined
          }
          report={p.author.id !== me?.id ? { type: "poll", id: p.id } : undefined}
        />
      </header>
      {full ? (
        <h1 className="h2 poll-q">{p.question}</h1>
      ) : (
        <Link href={`/polls/${p.id}`} className="h3 poll-q">
          {p.question}
        </Link>
      )}
      {p.html ? (
        <div className="post-body">
          <RichText html={p.html} fold={full ? 0 : 220} />
        </div>
      ) : null}
      <div className="poll-options" role={voting ? "group" : undefined} aria-label={t("Choices")}>
        {p.options.map((o) => {
          const pct = total ? Math.round((o.votes / total) * 100) : 0;
          const sel = voting ? picked.includes(o.id) : o.mine;
          return (
            <button
              key={o.id}
              type="button"
              className={`poll-opt ${sel ? "sel" : ""} ${voting ? "voting" : "result"} ${!voting && o.votes === max && total ? "lead" : ""}`}
              onClick={() => voting && toggle(o.id)}
              disabled={!voting || pending}
              aria-pressed={sel}
            >
              {p.showResults && !voting ? <i className="poll-fill" style={{ width: `${pct}%` }} /> : null}
              <span className={`poll-mark ${p.multiple ? "box" : ""}`}>{sel ? <Check size={13} strokeWidth={3} /> : null}</span>
              <span className="poll-label">{o.label}</span>
              {p.showResults && !voting ? (
                <span className="poll-pct">
                  {pct}% <span className="faint">· {o.votes}</span>
                </span>
              ) : null}
              {p.showResults && !voting && o.voters.length ? (
                <span className="avatar-stack poll-voters">
                  {o.voters.slice(0, 5).map((v) => (
                    <Avatar key={v.id} user={v} size={20} />
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {voting && p.multiple ? (
        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" className={`btn btn-primary btn-sm ${pending ? "loading" : ""}`} disabled={!picked.length} onClick={() => submit(picked)}>
            <Check size={15} /> {t("Vote")}
          </button>
          <span className="small muted">{p.maxChoices ? t("Pick up to {n}", { n: p.maxChoices }) : t("Pick as many as you like")}</span>
        </div>
      ) : null}
      {p.allowAdd && !p.closed ? (
        <form
          className="input-group poll-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (!adding.trim()) return;
            start(async () => {
              const r = await addOptionAction(p.id, adding);
              if (r.ok && r.data) {
                setP(r.data);
                setAdding("");
              } else if (!r.ok) toast(r.error, { kind: "err" });
            });
          }}
        >
          <input className="input sm" value={adding} onChange={(e) => setAdding(e.target.value)} placeholder={t("Add a choice…")} maxLength={120} />
          <button type="submit" className="btn btn-sm" disabled={!adding.trim()}>
            <Plus size={15} /> {t("Add")}
          </button>
        </form>
      ) : null}
      <div className="poll-meta small muted">
        <span>{t.n(p.totalVoters, "{n} vote", "{n} votes")}</span>
        {p.closed ? (
          <span className="pill danger">
            <Lock size={11} /> {t("Closed")}
          </span>
        ) : p.closesAt ? (
          <span className="row" style={{ gap: 4 }} suppressHydrationWarning>
            <Clock size={13} /> {t("closes {when}", { when: relative(p.closesAt) })}
          </span>
        ) : null}
        {p.anonymous ? (
          <span className="row" style={{ gap: 4 }}>
            <EyeOff size={13} /> {t("anonymous")}
          </span>
        ) : null}
        {!p.showResults ? <span>{t(p.results === "after_vote" ? "Results show once you've voted" : "Results show when it closes")}</span> : null}
        {p.voted && !p.closed && p.allowChange && !changing ? (
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setChanging(true)}>
            {t("Change my vote")}
          </button>
        ) : null}
        {changing ? (
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setChanging(false)}>
            {t("Keep my vote")}
          </button>
        ) : null}
      </div>
      <footer className="post-foot">
        <Reactions type="poll" id={p.id} initial={p.reactions} myName={me?.name ?? ""} />
        <span className="spacer" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>
          <MessageSquare size={16} /> {count ? t.n(count, "{n} comment", "{n} comments") : t("Comment{verb}", { verb: "" })}
        </button>
      </footer>
      {open ? <Comments type="poll" id={p.id} onCount={setCount} /> : null}
      {node}
    </article>
  );
}
