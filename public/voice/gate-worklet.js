// The microphone gate for voice chat, in the browser's audio thread (so it keeps working when
// the tab is in the background). What goes out to the call opens when you're louder than the
// sensitivity (threshold, in dB) and stays open a moment after (so words don't get clipped), or,
// with push to talk, only while the key is held (force: 1 open, -1 shut, 0 by loudness). It tells
// the page how loud the microphone is, for the level meter in the voice settings.

const HOLD_SECONDS = 0.35;
const ATTACK_SECONDS = 0.005;
const RELEASE_SECONDS = 0.05;

class CommunarrGate extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "threshold", defaultValue: -100, minValue: -100, maxValue: 0, automationRate: "k-rate" },
      { name: "force", defaultValue: 0, minValue: -1, maxValue: 1, automationRate: "k-rate" },
    ];
  }

  constructor() {
    super();
    this.open = true;
    this.hold = 0;
    this.gain = 1;
    this.level = -100;
    this.blocks = 0;
  }

  process(inputs, outputs, params) {
    const input = inputs[0] || [];
    const output = outputs[0] || [];
    const first = input[0];
    const frames = output[0] ? output[0].length : 128;

    // how loud this block is (RMS, in dB); the meter falls back slowly so it's readable
    let sum = 0;
    if (first) for (let i = 0; i < first.length; i++) sum += first[i] * first[i];
    const rms = first && first.length ? Math.sqrt(sum / first.length) : 0;
    const db = rms > 0 ? Math.max(-100, 20 * Math.log10(rms)) : -100;
    this.level = Math.max(db, this.level - 0.6);

    const force = params.force[0];
    const threshold = params.threshold[0];
    if (force > 0.5) {
      this.open = true;
      this.hold = 0;
    } else if (force < -0.5) {
      this.open = false;
      this.hold = 0;
    } else if (threshold <= -99.5 || db > threshold) {
      this.open = true;
      this.hold = Math.round((HOLD_SECONDS * sampleRate) / frames);
    } else if (this.hold > 0) this.hold--;
    else this.open = false;

    // a smooth ramp, the same for every channel
    const target = this.open ? 1 : 0;
    const step = 1 / ((this.open ? ATTACK_SECONDS : RELEASE_SECONDS) * sampleRate);
    const gains = new Float32Array(frames);
    let g = this.gain;
    for (let i = 0; i < frames; i++) {
      g += Math.max(-step, Math.min(step, target - g));
      gains[i] = g;
    }
    this.gain = g;
    for (let c = 0; c < output.length; c++) {
      const src = input[c] || first;
      const out = output[c];
      for (let i = 0; i < frames; i++) out[i] = src ? src[i] * gains[i] : 0;
    }

    // about sixty times a second: the level and whether it's open
    if (++this.blocks % 6 === 0) this.port.postMessage({ level: this.level, open: this.open });
    return true;
  }
}

registerProcessor("communarr-gate", CommunarrGate);
