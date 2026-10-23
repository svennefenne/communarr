"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/ui";
import { useT, useToast } from "@/components/app/AppProvider";
import { reportAction } from "@/app/actions/content";
import type { ReportTarget } from "@/lib/reports";

/** English: translated where shown, and in the report the moderators read. */
const REASONS = ["Mean or hurtful", "Spam", "Shouldn't be here", "Something else"];

/** Tell the moderators about something. */
export function ReportDialog({ type, id, onClose }: { type: ReportTarget; id: number; onClose: () => void }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const t = useT();
  const toast = useToast();
  return (
    <Modal
      title={t("Report to the moderators")}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button
            type="button"
            className={`btn btn-primary ${pending ? "loading" : ""}`}
            onClick={() =>
              start(async () => {
                const r = await reportAction(type, id, `${t(reason)}${text ? `: ${text}` : ""}`);
                if (r.ok) {
                  toast(t("Thanks: the moderators will have a look."));
                  onClose();
                } else toast(r.error, { kind: "err" });
              })
            }
          >
            {t("Send report")}
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="stack tight">
          {REASONS.map((r) => (
            <label key={r} className="check">
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
              {t(r)}
            </label>
          ))}
        </div>
        <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} maxLength={400} placeholder={t("Anything the moderators should know? (optional)")} />
        <p className="hint" style={{ margin: 0 }}>
          {t("Only moderators and admins see reports.")}
        </p>
      </div>
    </Modal>
  );
}
