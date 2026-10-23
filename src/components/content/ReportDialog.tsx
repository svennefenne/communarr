"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/ui";
import { useToast } from "@/components/app/AppProvider";
import { reportAction } from "@/app/actions/content";
import type { ReportTarget } from "@/lib/reports";

const REASONS = ["Mean or hurtful", "Spam", "Shouldn't be here", "Something else"];

/** Tell the moderators about something. */
export function ReportDialog({ type, id, onClose }: { type: ReportTarget; id: number; onClose: () => void }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Modal
      title="Report to the moderators"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn btn-primary ${pending ? "loading" : ""}`}
            onClick={() =>
              start(async () => {
                const r = await reportAction(type, id, `${reason}${text ? `: ${text}` : ""}`);
                if (r.ok) {
                  toast("Thanks: the moderators will have a look.");
                  onClose();
                } else toast(r.error, { kind: "err" });
              })
            }
          >
            Send report
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="stack tight">
          {REASONS.map((r) => (
            <label key={r} className="check">
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
              {r}
            </label>
          ))}
        </div>
        <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} maxLength={400} placeholder="Anything the moderators should know? (optional)" />
        <p className="hint" style={{ margin: 0 }}>
          Only moderators and admins see reports.
        </p>
      </div>
    </Modal>
  );
}
