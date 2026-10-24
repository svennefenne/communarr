"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Trash2, Upload } from "lucide-react";
import { useT, useToast } from "@/components/app/AppProvider";
import { uploadFile } from "@/components/ui/ui";
import { playSound } from "@/components/app/sfx";
import { saveSettingsAction } from "@/app/actions/admin";
import { SOUND_TRIGGERS, TONES, type SoundSettings, type SoundTrigger } from "@/lib/sounds";
import { SaveBar } from "./Section";

/**
 * Admin → Sounds: the sound files (upload, name, listen, remove) and, for each thing that happens on
 * the site, which sound plays and how loud. Members can turn sounds off for themselves in their menu.
 */
export function SoundsAdmin({ initial }: { initial: SoundSettings }) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  const setTrigger = (id: SoundTrigger, patch: Partial<SoundSettings["triggers"][SoundTrigger]>) => setS((x) => ({ ...x, triggers: { ...x.triggers, [id]: { ...x.triggers[id], ...patch } } }));
  const save = (next = s) =>
    start(async () => {
      const r = await saveSettingsAction({ sounds: next });
      if (!r.ok) toast(r.error, { kind: "err" });
      else {
        toast(t("Saved."));
        router.refresh();
      }
    });
  const upload = async (f: File) => {
    setUploading(true);
    try {
      const up = await uploadFile(f, "sound");
      if (!up.id) throw new Error(t("The upload didn't work."));
      const next = { ...s, library: [...s.library, { id: up.id, url: up.url, name: f.name.replace(/\.[^.]+$/, "").slice(0, 60) }] };
      setS(next);
      // kept straight away (so it isn't cleaned up as unused)
      save(next);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), { kind: "err" });
    } finally {
      setUploading(false);
      if (file.current) file.current.value = "";
    }
  };
  const remove = (id: string) => {
    const gone = `file:${id}`;
    const triggers = Object.fromEntries(Object.entries(s.triggers).map(([k, v]) => [k, v.sound === gone ? { ...v, sound: "" } : v])) as SoundSettings["triggers"];
    setS({ library: s.library.filter((f) => f.id !== id), triggers });
  };
  return (
    <div className="stack loose">
      <div className="stack tight">
        <div className="row wrap" style={{ justifyContent: "space-between" }}>
          <span className="label">{t("Sound files · {n}", { n: s.library.length })}</span>
          <button type="button" className={`btn btn-sm ${uploading ? "loading" : ""}`} onClick={() => file.current?.click()}>
            <Upload size={15} /> {t("Upload a sound")}
          </button>
          <input ref={file} type="file" accept="audio/*,.mp3,.ogg,.wav,.m4a,.flac,.webm" hidden onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        </div>
        {s.library.length ? (
          <div className="list inset">
            {s.library.map((f) => (
              <div key={f.id} className="list-row">
                <button type="button" className="icon-btn xs" onClick={() => void playSound(`file:${f.id}`, 70, s.library, true)} aria-label={t("Listen to {name}", { name: f.name })}>
                  <Play size={14} />
                </button>
                <input
                  className="input sm grow"
                  value={f.name}
                  maxLength={60}
                  onChange={(e) => setS((x) => ({ ...x, library: x.library.map((y) => (y.id === f.id ? { ...y, name: e.target.value } : y)) }))}
                  aria-label={t("The sound's name")}
                />
                <button type="button" className="icon-btn xs" onClick={() => remove(f.id)} aria-label={t("Remove {name}", { name: f.name })}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            {t("No sound files yet: the built-in sounds work without any. MP3, OGG, WAV, FLAC, M4A or WebM, at most 2 MB each.")}
          </p>
        )}
      </div>

      <div className="stack tight">
        <span className="label">{t("When it plays")}</span>
        <div className="sound-rows">
          {SOUND_TRIGGERS.map(({ id, label }) => {
            const v = s.triggers[id];
            return (
              <div key={id} className="sound-row">
                <span className="sound-what small">{t(label)}</span>
                <select className="select sm" value={v.sound} onChange={(e) => setTrigger(id, { sound: e.target.value })} aria-label={t("Sound for: {what}", { what: t(label) })}>
                  <option value="">{t("No sound")}</option>
                  <optgroup label={t("Built-in")}>
                    {(Object.keys(TONES) as (keyof typeof TONES)[]).map((k) => (
                      <option key={k} value={`tone:${k}`}>
                        {t(TONES[k])}
                      </option>
                    ))}
                  </optgroup>
                  {s.library.length ? (
                    <optgroup label={t("Uploaded")}>
                      {s.library.map((f) => (
                        <option key={f.id} value={`file:${f.id}`}>
                          {f.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={v.volume}
                  disabled={!v.sound}
                  onChange={(e) => setTrigger(id, { volume: Number(e.target.value) })}
                  aria-label={t("Volume for: {what}", { what: t(label) })}
                />
                <span className="tiny muted sound-vol">{v.volume}%</span>
                <button type="button" className="icon-btn xs" disabled={!v.sound} onClick={() => void playSound(v.sound, v.volume, s.library, true)} aria-label={t("Listen")}>
                  <Play size={14} />
                </button>
              </div>
            );
          })}
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          {t("Never for what you do yourself. Everyone can turn sounds off for themselves in their menu; voice chat isn't affected.")}
        </p>
      </div>
      <SaveBar pending={pending} onSave={() => save()} />
    </div>
  );
}
