"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Modal } from "@/components/ui/ui";
import { useT, useToast } from "@/components/app/AppProvider";
import { sendFeedbackAction } from "@/app/actions/feedback";

/** The user menu's "Send feedback": ideas, wishes and bugs, straight to the admins. */
export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const path = usePathname();
  const [text, setText] = useState("");
  const [withPage, setWithPage] = useState(true);
  const [pending, start] = useTransition();
  const send = () =>
    start(async () => {
      const page = withPage ? `${path}${window.location.search}` : "";
      const r = await sendFeedbackAction(text, page);
      if (r.ok) {
        toast(t("Thanks! The admins will read it."));
        onClose();
      } else toast(r.error, { kind: "err" });
    });
  return (
    <Modal
      title={t("Send feedback")}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className={`btn btn-primary ${pending ? "loading" : ""}`} disabled={pending || !text.trim()} onClick={send}>
            {t("Send")}
          </button>
        </>
      }
    >
      <div className="stack">
        <p className="small muted" style={{ margin: 0 }}>
          {t("Ideas, wishes, something that doesn't work? Tell the admins.")}
        </p>
        <textarea
          className="textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={4000}
          autoFocus
          placeholder={t("What's on your mind?")}
          aria-label={t("Your feedback")}
          style={{ minHeight: 140 }}
          onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === "Enter" && text.trim() && send()}
        />
        <label className="check">
          <input type="checkbox" checked={withPage} onChange={(e) => setWithPage(e.target.checked)} />
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
            {t("Include the page I'm on")} <span className="muted">({path})</span>
          </span>
        </label>
        <p className="hint" style={{ margin: 0 }}>
          {t("Only admins see feedback, with your name.")}
        </p>
      </div>
    </Modal>
  );
}
