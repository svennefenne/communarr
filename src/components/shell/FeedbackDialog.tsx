"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { Modal, uploadFile } from "@/components/ui/ui";
import { useT, useToast } from "@/components/app/AppProvider";
import { sendFeedbackAction } from "@/app/actions/feedback";

// as many as the server keeps (lib/feedback FEEDBACK_MAX_IMAGES)
const MAX_SHOTS = 6;

/**
 * The user menu's "Send feedback": ideas, wishes and bugs, straight to the admins, with screenshots
 * if they help (pasted, dropped or picked; uploaded as they're added).
 */
export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const path = usePathname();
  const [text, setText] = useState("");
  const [withPage, setWithPage] = useState(true);
  const [shots, setShots] = useState<{ url: string; thumb?: string }[]>([]);
  const [uploading, setUploading] = useState(0);
  const [pending, start] = useTransition();
  const pick = useRef<HTMLInputElement>(null);
  const ready = !pending && !uploading && (!!text.trim() || shots.length > 0);

  // screenshots kept or on their way, counted at once (pastes can come faster than the screen updates)
  const taken = useRef(0);
  // one upload at a time, in the order they came (the server takes only a few at once from someone)
  const queue = useRef<Promise<void>>(Promise.resolve());
  const add = (files: File[]) => {
    const pics = files.filter((f) => f.type.startsWith("image/"));
    if (!pics.length) return;
    const take = pics.slice(0, Math.max(0, MAX_SHOTS - taken.current));
    if (take.length < pics.length) toast(t("Up to {n} screenshots.", { n: MAX_SHOTS }), { kind: "err" });
    taken.current += take.length;
    setUploading((n) => n + take.length);
    for (const f of take)
      queue.current = queue.current.then(async () => {
        try {
          const up = await uploadFile(f, "image");
          setShots((s) => [...s, { url: up.url, thumb: up.thumb }]);
        } catch (e) {
          taken.current -= 1;
          toast(e instanceof Error ? e.message : t("The upload didn't work."), { kind: "err" });
        } finally {
          setUploading((n) => n - 1);
        }
      });
  };
  const remove = (url: string) => {
    taken.current -= 1;
    setShots((all) => all.filter((x) => x.url !== url));
  };

  const send = () =>
    start(async () => {
      const page = withPage ? `${path}${window.location.search}` : "";
      const r = await sendFeedbackAction(text, page, shots.map((s) => ({ url: s.url })));
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
          <button type="button" className={`btn btn-primary ${pending ? "loading" : ""}`} disabled={!ready} onClick={send}>
            {t("Send")}
          </button>
        </>
      }
    >
      {/* a screenshot pasted or dropped anywhere in here goes with it */}
      <div
        className="stack"
        onPaste={(e) => {
          const files = [...e.clipboardData.files];
          if (!files.some((f) => f.type.startsWith("image/"))) return;
          e.preventDefault();
          add(files);
        }}
        onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
        onDrop={(e) => {
          const files = [...e.dataTransfer.files];
          if (!files.length) return;
          e.preventDefault();
          add(files);
        }}
      >
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
          onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === "Enter" && ready && send()}
        />
        <div className="fb-shots" aria-label={t("Screenshots")}>
          {shots.map((s, i) => (
            <span key={s.url} className="fb-shot">
              <img src={s.thumb ?? s.url} alt={t("Screenshot {n}", { n: i + 1 })} />
              <button type="button" className="fb-shot-x" onClick={() => remove(s.url)} aria-label={t("Remove screenshot {n}", { n: i + 1 })} title={t("Remove")}>
                <X size={13} />
              </button>
            </span>
          ))}
          {Array.from({ length: uploading }, (_, i) => (
            <span key={`up-${i}`} className="fb-shot busy" aria-label={t("Uploading…")}>
              <LoaderCircle size={20} className="spin" />
            </span>
          ))}
          {shots.length + uploading < MAX_SHOTS ? (
            <button type="button" className="fb-shot add" onClick={() => pick.current?.click()} title={t("Add a screenshot")} aria-label={t("Add a screenshot")}>
              <ImagePlus size={20} />
            </button>
          ) : null}
          <input
            ref={pick}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              add(files);
            }}
          />
        </div>
        <span className="hint" style={{ marginTop: -6 }}>
          {t("Paste a screenshot (Ctrl+V), drop one here or add one: up to {n}.", { n: MAX_SHOTS })}
        </span>
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
