"use client";

import { useEffect, useRef, useState } from "react";
import { Keyboard, Mic, Square } from "lucide-react";
import { useT } from "@/components/app/AppProvider";
import { useVoice } from "./VoiceProvider";
import { keyName, openPipeline, type MicLevel, type NoiseMode, type Pipeline } from "./pipeline";

/** dB to a share of the meter (-100 … 0 dB, the useful part stretched) */
const pct = (db: number) => Math.round(Math.min(1, Math.max(0, (db + 90) / 80)) * 100);

/**
 * Your voice chat settings on this device: push to talk (and its key) or by input sensitivity, the
 * sensitivity with a live meter, and noise suppression. In a call they apply straight away; outside
 * one, "Test the microphone" shows the meter.
 */
export function VoiceSettings() {
  const t = useT();
  const v = useVoice();
  const p = v.prefs;
  const [level, setLevel] = useState<MicLevel>({ level: -100, open: false });
  const [testing, setTesting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [testInfo, setTestInfo] = useState<{ processed: boolean; noise: NoiseMode } | null>(null);
  const test = useRef<Pipeline | null>(null);
  const inCall = v.room != null;

  // the meter: from the call, or from a test of the microphone
  useEffect(() => {
    if (inCall) return v.onMicLevel(setLevel);
  }, [inCall, v]);
  useEffect(() => {
    if (!testing || inCall) return;
    let gone = false;
    let off = () => {};
    openPipeline(p)
      .then((pipe) => {
        if (gone) return pipe.close();
        test.current = pipe;
        setTestInfo({ processed: pipe.processed, noise: pipe.noise });
        // (a test always listens: push to talk would keep the meter at nothing)
        pipe.setForce(0);
        off = pipe.onLevel(setLevel);
      })
      .catch(() => setTesting(false));
    return () => {
      gone = true;
      off();
      test.current?.close();
      test.current = null;
      setLevel({ level: -100, open: false });
    };
    // a new kind of noise suppression starts the test over
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testing, inCall, p.noise]);
  useEffect(() => {
    test.current?.setThreshold(p.threshold);
  }, [p.threshold]);

  // picking the push-to-talk key: the next key pressed (Escape: never mind)
  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setPicking(false);
      if (e.code !== "Escape") void v.setPrefs({ ...p, key: e.code });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [picking, p, v]);

  const live = inCall || testing;
  const processed = inCall ? v.processed : (testInfo?.processed ?? true);
  const noise = inCall ? v.noiseInUse : testInfo?.noise;
  return (
    <div className="stack voice-settings">
      <div className="field">
        <span className="label">{t("How your voice is sent")}</span>
        <div className="pills" role="group" aria-label={t("How your voice is sent")}>
          <button type="button" className={`pill ${p.mode === "open" ? "active" : ""}`} aria-pressed={p.mode === "open"} onClick={() => void v.setPrefs({ ...p, mode: "open" })}>
            <Mic size={14} /> {t("When you talk")}
          </button>
          <button type="button" className={`pill ${p.mode === "ptt" ? "active" : ""}`} aria-pressed={p.mode === "ptt"} onClick={() => void v.setPrefs({ ...p, mode: "ptt" })}>
            <Keyboard size={14} /> {t("Push to talk")}
          </button>
        </div>
      </div>

      {p.mode === "ptt" ? (
        <div className="field">
          <span className="label">{t("Push-to-talk key")}</span>
          <div className="row wrap" style={{ gap: 10 }}>
            <kbd className="kbd voice-key">{picking ? "…" : keyName(p.key)}</kbd>
            <button type="button" className="btn btn-sm" onClick={() => setPicking((x) => !x)}>
              {picking ? t("Press a key (Esc: cancel)") : t("Change the key")}
            </button>
          </div>
          <span className="small muted">{t("Hold it to talk while you're in a voice chat. It works while the site's tab is in front, and not while you're typing in a field.")}</span>
        </div>
      ) : (
        <div className="field">
          <label className="label" htmlFor="voice-sens">
            {t("Input sensitivity")}
          </label>
          {/* the level now, and the line it has to cross to be sent */}
          <div className={`voice-meter ${live ? "" : "idle"}`}>
            <span className="voice-meter-level" style={{ width: `${live ? pct(level.level) : 0}%` }} data-open={level.open || undefined} />
            <span className="voice-meter-line" style={{ left: `${p.threshold <= -100 ? 0 : pct(p.threshold)}%` }} />
            <input
              id="voice-sens"
              type="range"
              min={-90}
              max={-10}
              step={1}
              value={Math.max(-90, p.threshold)}
              onChange={(e) => {
                const db = Number(e.target.value);
                void v.setPrefs({ ...p, threshold: db <= -90 ? -100 : db });
              }}
              aria-label={t("Input sensitivity")}
            />
          </div>
          <span className="small muted">
            {p.threshold <= -100 ? t("Everything is sent. Drag right so quiet sounds (a fan, typing) aren't.") : t("Quieter than the line isn't sent. The bar turns green when you would be heard.")}
          </span>
        </div>
      )}

      <div className="field">
        <label className="label" htmlFor="voice-noise">
          {t("Noise suppression")}
        </label>
        <select id="voice-noise" className="select" value={p.noise} onChange={(e) => void v.setPrefs({ ...p, noise: e.target.value as NoiseMode })} style={{ maxWidth: 360 }}>
          <option value="off">{t("Off")}</option>
          <option value="browser">{t("Standard (the browser's own)")}</option>
          <option value="strong">{t("Strong (RNNoise, open source)")}</option>
        </select>
        {noise && noise !== p.noise ? <span className="small muted">{t("This browser can't run the strong kind here: the browser's own is used.")}</span> : null}
      </div>

      {!processed ? <p className="small muted">{t("This browser can't adjust the microphone: push to talk and input sensitivity need a newer one.")}</p> : null}

      {!inCall ? (
        <button type="button" className={`btn btn-sm ${testing ? "btn-danger" : ""}`} style={{ alignSelf: "flex-start" }} onClick={() => setTesting((x) => !x)}>
          {testing ? <Square size={14} /> : <Mic size={14} />} {testing ? t("Stop the test") : t("Test the microphone")}
        </button>
      ) : null}
    </div>
  );
}
