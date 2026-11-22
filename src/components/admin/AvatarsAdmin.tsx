"use client";

import { useState } from "react";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { useT, useToast } from "@/components/app/AppProvider";
import { uploadFile } from "@/components/ui/ui";
import { addAvatarPresetsAction, removeAvatarPresetAction } from "@/app/actions/avatars";
import type { AvatarPreset } from "@/lib/avatarPresets";

/**
 * Admin → Avatars: pictures members can pick for their profile, up to `max`. Many at once (choose
 * them, or drop them here); each is made square around what's in it and shown round, as it will be,
 * with the name of the member whose picture it is.
 */
export function AvatarsAdmin({ initial, max }: { initial: AvatarPreset[]; max: number }) {
  const t = useT();
  const toast = useToast();
  const [list, setList] = useState(initial);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inUse = list.filter((a) => a.holder).length;

  const upload = async (files: File[]) => {
    const all = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif|avif|webp)$/i.test(f.name));
    if (!all.length || progress) return;
    // (only as many as there's room for: the rest aren't sent at all)
    const room = Math.max(0, max - list.length);
    if (!room) return toast(t("There's no room for more: {max} avatars is the most. Take some away first.", { max }), { kind: "err" });
    const pics = all.slice(0, room);
    const over = all.length - pics.length;
    const urls: (string | null)[] = new Array(pics.length).fill(null);
    let next = 0;
    let done = 0;
    let failed = 0;
    setProgress({ done, total: pics.length, failed });
    // (three at a time: the server takes a few pictures from one person at once, not a pile)
    const worker = async () => {
      while (next < pics.length) {
        const i = next++;
        try {
          urls[i] = (await uploadFile(pics[i], "avatar")).url;
        } catch {
          failed++;
        }
        done++;
        setProgress({ done, total: pics.length, failed });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    const got = urls.filter((u): u is string => !!u);
    const res = got.length ? await addAvatarPresetsAction(got) : null;
    setProgress(null);
    if (res && !res.ok) return toast(res.error, { kind: "err" });
    if (res?.ok) setList(res.data);
    toast(
      [failed ? t("{n} added, {m} didn't work (not a picture, or too big).", { n: got.length, m: failed }) : t.n(got.length, "{n} avatar added.", "{n} avatars added."), over ? t("{n} more didn't fit: there's room for {max} avatars in all.", { n: over, max }) : ""].filter(Boolean).join(" "),
      failed || over ? { kind: "err" } : undefined,
    );
  };

  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>
        {t("Pictures members can choose for their profile, besides one of their own (Settings → Profile). Each is one member's at a time: one someone has can't be chosen by anyone else. Square ones work best: they're shown round, so the corners don't show. Other shapes are cut to a square around what's in them.")}
      </p>
      <label
        className={`avatar-drop ${dragOver ? "over" : ""} ${progress ? "busy" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void upload([...e.dataTransfer.files]);
        }}
      >
        {progress ? <LoaderCircle size={22} className="spin" /> : <ImagePlus size={22} />}
        <span className="stack tight" style={{ alignItems: "flex-start" }}>
          <b>{progress ? t("Uploading {done} of {total}…", { done: progress.done, total: progress.total }) : t("Choose pictures, or drop them here")}</b>
          <span className="tiny muted">{t("Many at once: JPEG, PNG, WebP, GIF or AVIF. Room for {max} in all.", { max })}</span>
        </span>
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          disabled={!!progress}
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            void upload(files);
          }}
        />
      </label>
      {list.length ? (
        <>
          <span className="small muted">
            {t("{n} of {max} avatars", { n: list.length, max })}
            {inUse ? ` · ${t.n(inUse, "{n} is someone's picture", "{n} are someone's pictures")}` : ""}
          </span>
          <div className="avatar-grid">
            {list.map((a) => (
              <div key={a.id} className={`avatar-tile ${a.holder ? "held" : ""}`} title={a.holder ? t("{name}'s picture", { name: a.holder.name }) : undefined}>
                <img src={a.url} alt="" loading="lazy" decoding="async" />
                {a.holder ? <span className="avatar-holder">{a.holder.name}</span> : null}
                <button
                  type="button"
                  className="avatar-remove"
                  title={t("Take it away")}
                  aria-label={t("Take it away")}
                  onClick={async () => {
                    const r = await removeAvatarPresetAction(a.id);
                    if (r.ok) setList(r.data);
                    else toast(r.error, { kind: "err" });
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <span className="small muted">{t("No avatars yet.")}</span>
      )}
    </div>
  );
}
