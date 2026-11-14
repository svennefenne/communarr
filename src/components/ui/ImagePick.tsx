"use client";

import { useState } from "react";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { uploadFile } from "./ui";
import { ImageLinkButton } from "./ImageLink";
import { BannerCrop } from "./BannerCrop";
import { useT, useToast } from "@/components/app/AppProvider";

/**
 * Pick a picture: shows it, uploads a new one (or takes one from a link), or takes it away. A banner is
 * placed first (BannerCrop): moved and zoomed in its frame, the band a wide screen shows marked.
 */
export function ImagePick({
  value,
  onChange,
  kind,
  shape = "wide",
  label,
  size,
  whole = false,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  kind: "avatar" | "banner" | "cover" | "background" | "logo" | "emoji";
  shape?: "round" | "square" | "wide" | "tall";
  label: string;
  /** the size the picture's best at (it's cut to it), and what of it shows */
  size?: string;
  /** show all of it (a logo) instead of filling the box */
  whole?: boolean;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  // a banner being placed: the picture (here, or a copy from a link), and the file it came from
  const [placing, setPlacing] = useState<{ src: string; file?: File } | null>(null);
  const toast = useToast();
  const upload = async (f: File) => {
    setBusy(true);
    try {
      onChange((await uploadFile(f, kind)).url);
    } catch (err) {
      toast(err instanceof Error ? err.message : t("The upload didn't work."), { kind: "err" });
    } finally {
      setBusy(false);
    }
  };
  const stopPlacing = () => {
    if (placing?.file) URL.revokeObjectURL(placing.src);
    setPlacing(null);
  };
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
            if (kind === "banner") setPlacing({ src: URL.createObjectURL(f), file: f });
            else await upload(f);
          }}
        />
      </label>
      <div className="stack tight">
        <span className="small">{label}</span>
        {size ? <span className="tiny muted">{size}</span> : null}
        {value ? null : <span className="tiny muted">{t("Tap to choose a picture")}</span>}
        <span className="row wrap" style={{ gap: 4 }}>
          {/* (a banner's: the whole picture, to place) */}
          <ImageLinkButton kind={kind === "banner" ? "image" : kind} onImage={(url) => (kind === "banner" ? setPlacing({ src: url }) : onChange(url))} className="btn btn-ghost btn-xs" />
          {value ? (
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => onChange(null)}>
              <Trash2 size={13} /> {t("Remove")}
            </button>
          ) : null}
        </span>
      </div>
      {placing ? (
        <BannerCrop
          src={placing.src}
          onClose={stopPlacing}
          onDone={async (f) => {
            await upload(f);
            stopPlacing();
          }}
          // (a picture this browser can't show, like an iPhone's HEIC: as it is, cut to fit by the site)
          onCantShow={() => {
            const f = placing.file;
            stopPlacing();
            if (f) void upload(f);
            else toast(t("That picture couldn't be shown here."), { kind: "err" });
          }}
        />
      ) : null}
    </div>
  );
}
