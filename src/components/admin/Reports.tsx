"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ExternalLink, Flag, X } from "lucide-react";
import type { ReportView } from "@/lib/reports";
import { useToast } from "@/components/app/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Time } from "@/components/ui/Time";
import { Empty } from "@/components/ui/ui";
import { resolveReportAction } from "@/app/actions/admin";

const TYPE: Record<string, string> = { post: "Post", comment: "Comment", thread: "Thread", reply: "Forum reply", poll: "Poll", event: "Event", message: "Chat message", user: "Member", group: "Group" };

export function Reports({ open, closed }: { open: ReportView[]; closed: ReportView[] }) {
  const toast = useToast();
  const router = useRouter();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const done = async (id: number, status: "resolved" | "dismissed") => {
    const r = await resolveReportAction(id, status, notes[id] ?? "");
    if (!r.ok) toast(r.error, { kind: "err" });
    router.refresh();
  };
  return (
    <div className="stack">
      {open.length ? (
        open.map((r) => (
          <div key={r.id} className="inset panel-pad-sm stack tight report">
            <div className="row wrap" style={{ gap: 8 }}>
              <span className="badge danger">
                <Flag size={11} /> {TYPE[r.type] ?? r.type}
              </span>
              <span className="small">
                {r.reporter ? (
                  <>
                    <Avatar user={r.reporter} size={18} /> <b>{r.reporter.name}</b>
                  </>
                ) : (
                  "Someone"
                )}{" "}
                · <Time t={r.createdAt} />
              </span>
            </div>
            <div className="small">
              <b>Why:</b> {r.reason}
            </div>
            <blockquote className="report-preview small dim">{r.preview}</blockquote>
            <div className="row wrap">
              <Link href={r.url} className="btn btn-sm">
                <ExternalLink size={14} /> Look at it
              </Link>
              <input className="input sm grow" value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} placeholder="A note on what you did (optional)" style={{ minWidth: 160 }} />
              <button type="button" className="btn btn-primary btn-sm" onClick={() => done(r.id, "resolved")}>
                <Check size={14} /> Dealt with
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => done(r.id, "dismissed")}>
                <X size={14} /> Nothing to do
              </button>
            </div>
          </div>
        ))
      ) : (
        <Empty icon={<Flag size={22} />} title="No open reports">
          When someone reports a post, comment or message, it lands here.
        </Empty>
      )}
      {closed.length ? (
        <details className="small">
          <summary className="muted" style={{ cursor: "pointer" }}>
            Handled · {closed.length}
          </summary>
          <div className="list inset" style={{ marginTop: 8 }}>
            {closed.map((r) => (
              <div key={r.id} className="list-row tiny">
                <span className="grow">
                  {TYPE[r.type]} · {r.reason} · <span className="muted">{r.status === "resolved" ? "dealt with" : "nothing to do"} by {r.resolvedBy?.name ?? "—"}</span>
                  {r.note ? <span className="muted"> · “{r.note}”</span> : null}
                </span>
                {r.resolvedAt ? <Time t={r.resolvedAt} /> : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
