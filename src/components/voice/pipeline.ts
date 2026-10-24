"use client";

// (types only here: the package defines its node with AudioWorkletNode as it loads, which the server
// doesn't have, so it's loaded in the browser when strong noise suppression is chosen)
import type { RnnoiseWorkletNode } from "@sapphi-red/web-noise-suppressor";

/**
 * What your microphone sends to a voice chat: the microphone, then (if you chose it) strong noise
 * suppression (RNNoise, open source, in the browser), then a gate that lets sound through when
 * you're louder than your input sensitivity, or only while you hold the push-to-talk key. Your
 * choices are kept on this device (another computer, another microphone, another keyboard).
 */

export type NoiseMode = "off" | "browser" | "strong";

export interface VoicePrefs {
  /** open: by input sensitivity (always, at the lowest); ptt: only while the key is held */
  mode: "open" | "ptt";
  /** the push-to-talk key (KeyboardEvent.code) */
  key: string;
  /** off: nothing; browser: the browser's own; strong: RNNoise */
  noise: NoiseMode;
  /** input sensitivity in dB: quieter than this isn't sent (-100: everything is) */
  threshold: number;
}

export const DEFAULT_VOICE_PREFS: VoicePrefs = { mode: "open", key: "KeyV", noise: "browser", threshold: -100 };

const KEY = "hd.voicePrefs";

export function loadVoicePrefs(): VoicePrefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<VoicePrefs>;
    return {
      mode: p.mode === "ptt" ? "ptt" : "open",
      key: typeof p.key === "string" && p.key ? p.key.slice(0, 40) : DEFAULT_VOICE_PREFS.key,
      noise: p.noise === "off" || p.noise === "strong" ? p.noise : "browser",
      threshold: Number.isFinite(p.threshold) ? Math.min(0, Math.max(-100, Number(p.threshold))) : DEFAULT_VOICE_PREFS.threshold,
    };
  } catch {
    return DEFAULT_VOICE_PREFS;
  }
}

export function saveVoicePrefs(p: VoicePrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode: for this visit only */
  }
}

/** A key's name for people: KeyV → V, Space → Space, Backquote → `. */
export function keyName(code: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  const names: Record<string, string> = { Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Backslash: "\\", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", CapsLock: "Caps Lock", ControlLeft: "Ctrl", ControlRight: "Ctrl (right)", AltLeft: "Alt", AltRight: "Alt Gr", ShiftLeft: "Shift", ShiftRight: "Shift (right)", MetaLeft: "⌘/Win" };
  return names[code] ?? code.replace(/^Numpad/, "Num ");
}

export interface MicLevel {
  /** dB, -100 … 0 */
  level: number;
  /** sending right now */
  open: boolean;
}

export interface Pipeline {
  /** what goes into the call */
  stream: MediaStream;
  /** the noise suppression in use (strong falls back to the browser's where RNNoise can't run) */
  noise: NoiseMode;
  /** false: an old browser without audio worklets: the microphone as it is (no sensitivity, no push to talk) */
  processed: boolean;
  setThreshold(db: number): void;
  /** 1: open (key held), -1: shut (key up), 0: by input sensitivity */
  setForce(f: -1 | 0 | 1): void;
  onLevel(fn: (l: MicLevel) => void): () => void;
  close(): void;
}

let rnnoiseWasm: Promise<ArrayBuffer> | null = null;

/** The microphone through noise suppression and the gate, as one stream for the call. */
export async function openPipeline(prefs: VoicePrefs): Promise<Pipeline> {
  const strong = prefs.noise === "strong";
  const mic = await navigator.mediaDevices.getUserMedia({
    // (RNNoise does the noise; the browser's own on top would only muddy it)
    audio: { echoCancellation: true, noiseSuppression: prefs.noise === "browser", autoGainControl: true, channelCount: 1 },
  });
  const listeners = new Set<(l: MicLevel) => void>();
  const stopMic = () => mic.getTracks().forEach((t) => t.stop());
  let ctx: AudioContext | null = null;
  try {
    // RNNoise wants 48 kHz; a browser that won't mix rates gets its own rate and the browser's suppression
    try {
      ctx = new AudioContext({ sampleRate: 48000 });
      ctx.createMediaStreamSource(mic).disconnect();
    } catch {
      await ctx?.close().catch(() => {});
      ctx = new AudioContext();
    }
    await ctx.audioWorklet.addModule("/voice/gate-worklet.js");
    const src = ctx.createMediaStreamSource(mic);
    let noise: NoiseMode = prefs.noise;
    let rn: RnnoiseWorkletNode | null = null;
    if (strong) {
      try {
        if (ctx.sampleRate !== 48000) throw new Error("rate");
        const lib = await import("@sapphi-red/web-noise-suppressor");
        rnnoiseWasm ??= lib.loadRnnoise({ url: "/voice/vendor/rnnoise.wasm", simdUrl: "/voice/vendor/rnnoise_simd.wasm" });
        const wasm = await rnnoiseWasm;
        await ctx.audioWorklet.addModule("/voice/vendor/rnnoise-worklet.js");
        rn = new lib.RnnoiseWorkletNode(ctx, { maxChannels: 1, wasmBinary: wasm });
      } catch {
        rnnoiseWasm = null;
        rn = null;
        noise = "browser";
        // the browser's own, then: ask for it on the track
        await mic
          .getAudioTracks()[0]
          ?.applyConstraints({ noiseSuppression: true })
          .catch(() => {});
      }
    }
    const gate = new AudioWorkletNode(ctx, "hooden-gate", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    const dest = ctx.createMediaStreamDestination();
    if (rn) src.connect(rn).connect(gate);
    else src.connect(gate);
    gate.connect(dest);
    const threshold = gate.parameters.get("threshold")!;
    const force = gate.parameters.get("force")!;
    threshold.value = prefs.threshold;
    force.value = prefs.mode === "ptt" ? -1 : 0;
    gate.port.onmessage = (e: MessageEvent<MicLevel>) => {
      for (const fn of listeners) fn(e.data);
    };
    const c = ctx;
    void c.resume();
    return {
      stream: dest.stream,
      noise,
      processed: true,
      setThreshold: (db) => threshold.setValueAtTime(Math.min(0, Math.max(-100, db)), c.currentTime),
      setForce: (f) => force.setValueAtTime(f, c.currentTime),
      onLevel: (fn) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      close: () => {
        listeners.clear();
        gate.port.onmessage = null;
        rn?.destroy();
        stopMic();
        dest.stream.getTracks().forEach((t) => t.stop());
        void c.close().catch(() => {});
      },
    };
  } catch {
    // no audio worklets here: the microphone as it is
    await ctx?.close().catch(() => {});
    return {
      stream: mic,
      noise: prefs.noise === "off" ? "off" : "browser",
      processed: false,
      // (sensitivity and push to talk need the gate: the settings say so)
      setThreshold: () => {},
      setForce: () => {},
      onLevel: () => () => {},
      close: stopMic,
    };
  }
}
