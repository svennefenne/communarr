"use client";

import { useState } from "react";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { uploadFile } from "./ui";
import { ImageLinkButton } from "./ImageLink";
import { useT, useToast } from "@/components/app/AppProvider";

/** Pick a picture: shows it, uploads a new one (or takes one from a link), or takes it away. */
export function ImagePick({
  value,
  onChange,
  kind,
  shape = "wide",
  label,
  whole = false,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  kind: "avatar" | "banner" | "cover" | "background" | "logo" | "emoji";
  shape?: "round" | "square" | "wide" | "tall";
  label: string;
  /** show all of it (a logo) instead of filling the box */
  whole?: boolean;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <div className="image-pick">
      <label className={`image-pick-box ${shape}`} style={value ? { backgroundImage: `url("${value}")`, ...(whole ? { backgroundSize: "contain" } : {}) } : undefined} title={label}>
        {busy ? <LoaderCircle size={22} className="spin" /> : !value ? <ImagePlus size={22} /> : null}
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setBusy(true);
            try {
              onChange((await uploadFile(f, kind)).url);
            } catch (err) {
              toast(err instanceof Error ? err.message : t("The upload didn't work."), { kind: "err" });
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <div className="stack tight">
        <span className="small">{label}</span>
        {value ? null : <span className="tiny muted">{t("Tap to choose a picture")}</span>}
        <span className="row wrap" style={{ gap: 4 }}>
          <ImageLinkButton kind={kind} onImage={onChange} className="btn btn-ghost btn-xs" />
          {value ? (
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => onChange(null)}>
              <Trash2 size={13} /> {t("Remove")}
            </button>
          ) : null}
        </span>
      </div>
    </div>
  );
}
