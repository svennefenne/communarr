"use client";

import type { SoundFile, Tone } from "@/lib/sounds";

/**
 * Playing the site's sounds: a Web Audio context of their own (voice chat has its own, and nothing
 * here goes near the microphone or a call). Built-in tones are made on the spot; uploaded files are
 * fetched and decoded once. Browsers only allow sound after the page has been touched, so the
 * context starts on the first click or key.
 */

let ctx: AudioContext | null = null;

// the member's Sounds switch (the menu sets it straight away, without waiting for the server)
let enabled = true;
export const soundsOn = () => enabled;
export function setSoundsOn(on: boolean) {
  enabled = on;
}

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
  } catch {
    return null;
  }
  return ctx;
}

/** The first click or key anywhere lets sound play from then on. */
export function unlockSounds() {
  const go = () => {
    void context()?.resume();
    window.removeEventListener("pointerdown", go);
    window.removeEventListener("keydown", go);
  };
  window.addEventListener("pointerdown", go);
  window.addEventListener("keydown", go);
}

// each tone: notes (Hz, start s, length s), a wave and how bright
const TONE_NOTES: Record<Tone, { wave: OscillatorType; notes: [number, number, number][] }> = {
  chime: { wave: "sine", notes: [[880, 0, 0.35], [1318.5, 0.09, 0.45]] },
  pop: { wave: "sine", notes: [[620, 0, 0.09]] },
  blip: { wave: "triangle", notes: [[1046.5, 0, 0.07]] },
  bell: { wave: "sine", notes: [[1046.5, 0, 0.9], [2093, 0, 0.5], [3135.9, 0, 0.3]] },
  knock: { wave: "triangle", notes: [[180, 0, 0.08], [160, 0.14, 0.08]] },
  join: { wave: "sine", notes: [[523.25, 0, 0.16], [659.25, 0.08, 0.16], [783.99, 0.16, 0.28]] },
  leave: { wave: "sine", notes: [[783.99, 0, 0.16], [659.25, 0.08, 0.16], [523.25, 0.16, 0.28]] },
};

function playTone(c: AudioContext, tone: Tone, volume: number) {
  const def = TONE_NOTES[tone];
  if (!def) return;
  const now = c.currentTime + 0.01;
  for (const [hz, at, len] of def.notes) {
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = def.wave;
    osc.frequency.setValueAtTime(hz, now + at);
    // the pop slides up a little
    if (tone === "pop") osc.frequency.exponentialRampToValueAtTime(hz * 1.5, now + at + len);
    env.gain.setValueAtTime(0.0001, now + at);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.35 * volume), now + at + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, now + at + len);
    osc.connect(env).connect(c.destination);
    osc.start(now + at);
    osc.stop(now + at + len + 0.05);
  }
}

const decoded = new Map<string, Promise<AudioBuffer>>();

function buffer(c: AudioContext, url: string): Promise<AudioBuffer> {
  let b = decoded.get(url);
  if (!b) {
    b = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      })
      .then((a) => c.decodeAudioData(a));
    // a failed one is tried again next time
    b.catch(() => decoded.delete(url));
    decoded.set(url, b);
  }
  return b;
}

/**
 * Play a sound ("tone:…" or "file:<id>") at a volume (0–100). Quietly nothing if the page can't play
 * sound yet, or the sound is gone. force: a preview button (it was clicked, so sound may play).
 */
export async function playSound(sound: string, volume: number, library: SoundFile[], force = false): Promise<void> {
  if (!sound || volume <= 0) return;
  const c = context();
  if (!c) return;
  if (c.state !== "running") {
    if (!force) return;
    await c.resume().catch(() => {});
  }
  const v = Math.min(1, volume / 100);
  if (sound.startsWith("tone:")) return playTone(c, sound.slice(5) as Tone, v);
  const file = library.find((f) => `file:${f.id}` === sound);
  if (!file) return;
  try {
    const b = await buffer(c, file.url);
    const src = c.createBufferSource();
    const gain = c.createGain();
    src.buffer = b;
    gain.gain.value = v;
    src.connect(gain).connect(c.destination);
    src.start();
  } catch {
    /* a file the browser can't play: nothing */
  }
}
