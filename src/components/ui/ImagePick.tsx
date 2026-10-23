"use client";

import { useState } from "react";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { uploadFile } from "./ui";
import { useT, useToast } from "@/components/app/AppProvider";

/** Pick a picture: shows it, uploads a new one, or takes it away. */
export function ImagePick({
  value,
  onChange,
  kind,
  shape = "wide",
  label,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  kind: "avatar" | "banner" | "cover" | "background";
  shape?: "round" | "square" | "wide" | "tall";
  label: string;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <div className="image-pick">
      <label className={`image-pick-box ${shape}`} style={value ? { backgroundImage: `url("${value}")` } : undefined} title={label}>
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
        {value ? (
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => onChange(null)} style={{ alignSelf: "flex-start" }}>
            <Trash2 size={13} /> {t("Remove")}
          </button>
        ) : (
          <span className="tiny muted">{t("Tap to choose a picture")}</span>
        )}
      </div>
    </div>
  );
}
