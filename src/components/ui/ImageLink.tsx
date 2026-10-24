"use client";

import { useState } from "react";
import { Link2, LoaderCircle } from "lucide-react";
import { importImage, Modal } from "./ui";
import { useT } from "@/components/app/AppProvider";

type Kind = "image" | "avatar" | "banner" | "background" | "cover";

/**
 * A picture from a link: paste where it is (a picture, or a page: then the page's own picture). The
 * site keeps a copy, so it stays even if the link stops working.
 */
export function ImageLinkDialog({ kind, onImage, onClose, title }: { kind: Kind; onImage: (url: string) => void; onClose: () => void; title?: string }) {
  const t = useT();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    if (!url.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      const up = await importImage(url.trim(), kind);
      if (up) {
        onImage(up.url);
        onClose();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("That picture couldn't be fetched."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={title ?? t("A picture from a link")}
      onClose={onClose}
      footer={
        <button type="button" className={`btn btn-primary ${busy ? "loading" : ""}`} disabled={!url.trim() || busy} onClick={() => void go()}>
          {busy ? <LoaderCircle size={15} className="spin" /> : null} {t("Use the picture")}
        </button>
      }
    >
      <div className="stack tight">
        <input
          className="input"
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          aria-label={t("The picture's link")}
          autoFocus
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            void go();
          }}
        />
        <p className="tiny muted" style={{ margin: 0 }}>
          {t("A link to a picture, or to a page: then the page's own picture is used. The site keeps a copy, so it stays even if the link stops working.")}
        </p>
        {err ? <div className="form-error">{err}</div> : null}
      </div>
    </Modal>
  );
}

/** "From a link": a button that opens ImageLinkDialog. */
export function ImageLinkButton({ kind, onImage, className = "btn btn-sm", label }: { kind: Kind; onImage: (url: string) => void; className?: string; label?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <Link2 size={15} /> {label ?? t("From a link")}
      </button>
      {open ? <ImageLinkDialog kind={kind} onImage={onImage} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
