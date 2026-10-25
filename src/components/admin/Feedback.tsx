"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, ExternalLink, RotateCcw, Trash2 } from "lucide-react";
import type { FeedbackView } from "@/lib/feedback";
import { useT, useToast } from "@/components/app/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Time } from "@/components/ui/Time";
import { Empty, useConfirm } from "@/components/ui/ui";
import { openLightbox } from "@/components/content/RichText";
import { deleteFeedbackAction, feedbackDoneAction } from "@/app/actions/admin";

/** Admin → Feedback: what members sent from the user menu, open ones first. */
export function Feedback({ items }: { items: FeedbackView[] }) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const { confirm, node } = useConfirm();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast(r.error ?? t("That didn't work."), { kind: "err" });
      router.refresh();
    });
  if (!items.length)
    return (
      <Empty title={t("No feedback yet")}>{t("When someone uses “Send feedback” in their menu, it lands here.")}</Empty>
    );
  return (
    <div className="stack">
      {items.map((f) => (
        <div key={f.id} className="inset panel-pad-sm stack tight" style={f.done ? { opacity: 0.6 } : undefined}>
          <div className="row wrap" style={{ gap: 8 }}>
            {f.author ? (
              <span className="row small" style={{ gap: 6, minWidth: 0 }}>
                <Avatar user={f.author} size={20} /> <b>{f.author.name}</b>
              </span>
            ) : (
              <span className="small muted">{t("Someone")}</span>
            )}
            <span className="tiny muted">
              <Time t={f.createdAt} />
            </span>
            {f.page ? (
              <Link href={f.page} className="tiny link row" style={{ gap: 3, minWidth: 0, overflowWrap: "anywhere" }}>
                <ExternalLink size={11} /> {f.page}
              </Link>
            ) : null}
            {f.done ? <span className="badge">{f.doneBy ? t("handled by {name}", { name: f.doneBy.name }) : t("Handled")}</span> : null}
          </div>
          {f.body ? <p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{f.body}</p> : null}
          {f.images.length ? (
            <div className="fb-shots big">
              {f.images.map((img, i) => (
                <button
                  key={img.url}
                  type="button"
                  className="fb-shot"
                  onClick={() => openLightbox(f.images.map((x, n) => ({ src: x.url, alt: t("Screenshot {n}", { n: n + 1 }) })), i)}
                  aria-label={t("Screenshot {n}", { n: i + 1 })}
                >
                  <img src={img.thumb ?? img.url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          ) : null}
          <div className="row wrap" style={{ gap: 6 }}>
            <button type="button" className="btn btn-sm" disabled={pending} onClick={() => run(() => feedbackDoneAction(f.id, !f.done))}>
              {f.done ? <RotateCcw size={14} /> : <Check size={14} />} {f.done ? t("Open again") : t("Mark as handled")}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={pending}
              onClick={() => confirm(t("Delete this feedback?"), t("Delete"), async () => run(() => deleteFeedbackAction(f.id)))}
            >
              <Trash2 size={14} /> {t("Delete")}
            </button>
          </div>
        </div>
      ))}
      {node}
    </div>
  );
}
