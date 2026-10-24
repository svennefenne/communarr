/**
 * The site's sounds (Admin → Sounds): for each trigger a sound and a volume. A sound is a built-in tone
 * (made in the browser, no file: "tone:chime") or one an admin uploaded ("file:<id>"); "" is none.
 * Each member can turn them all off (the menu's Sounds switch); voice chat isn't touched by any of it.
 */

export type SoundTrigger = "online" | "voiceJoin" | "voiceLeave" | "post" | "message" | "event" | "poll";

/** English, translated where shown. */
export const SOUND_TRIGGERS: { id: SoundTrigger; label: string }[] = [
  { id: "online", label: "Someone comes online" },
  { id: "voiceJoin", label: "Someone joins the voice chat you're in" },
  { id: "voiceLeave", label: "Someone leaves the voice chat you're in" },
  { id: "post", label: "A new post (posts, news, forum threads)" },
  { id: "message", label: "A chat message in one of your rooms" },
  { id: "event", label: "A new event" },
  { id: "poll", label: "A new poll" },
];

/** The built-in tones (English names, translated where shown). */
export const TONES = { chime: "Chime", pop: "Pop", blip: "Blip", bell: "Bell", knock: "Knock", join: "Rising", leave: "Falling" } as const;
export type Tone = keyof typeof TONES;

export interface SoundFile {
  id: string;
  /** what the admin called it (the file's name to begin with) */
  name: string;
  url: string;
}

export interface TriggerSound {
  /** "" none, "tone:<name>" a built-in, "file:<id>" an upload */
  sound: string;
  /** 0–100 */
  volume: number;
}

export interface SoundSettings {
  library: SoundFile[];
  triggers: Record<SoundTrigger, TriggerSound>;
}

/** To begin with: a rising and a falling tone for voice chat, nothing else. */
export const DEFAULT_SOUNDS: SoundSettings = {
  library: [],
  triggers: {
    online: { sound: "", volume: 50 },
    voiceJoin: { sound: "tone:join", volume: 60 },
    voiceLeave: { sound: "tone:leave", volume: 60 },
    post: { sound: "", volume: 50 },
    message: { sound: "", volume: 50 },
    event: { sound: "", volume: 50 },
    poll: { sound: "", volume: 50 },
  },
};

const SOUND_URL = /^\/media\/sound\/[\w/.-]+\.(mp3|ogg|oga|wav|m4a|webm|flac)$/;

/** Sound settings from the outside (the Admin page), checked; anything odd falls back to the defaults. */
export function cleanSounds(x: unknown): SoundSettings {
  const o = (x && typeof x === "object" ? x : {}) as Partial<SoundSettings>;
  const library = (Array.isArray(o.library) ? o.library : [])
    .filter((f): f is SoundFile => !!f && typeof f.id === "string" && /^[\w-]{4,64}$/.test(f.id) && typeof f.url === "string" && SOUND_URL.test(f.url))
    .slice(0, 100)
    .map((f) => ({ id: f.id, url: f.url, name: String(f.name ?? "").replace(/\s+/g, " ").trim().slice(0, 60) || f.id }));
  const ids = new Set(library.map((f) => f.id));
  const triggers = { ...DEFAULT_SOUNDS.triggers };
  const given = (o.triggers && typeof o.triggers === "object" ? o.triggers : {}) as Partial<Record<SoundTrigger, Partial<TriggerSound>>>;
  for (const { id } of SOUND_TRIGGERS) {
    const g = given[id];
    if (!g) continue;
    const s = String(g.sound ?? "");
    const ok = s === "" || (s.startsWith("tone:") && s.slice(5) in TONES) || (s.startsWith("file:") && ids.has(s.slice(5)));
    triggers[id] = { sound: ok ? s : "", volume: Math.min(100, Math.max(0, Math.round(Number(g.volume) || 0))) };
  }
  return { library, triggers };
}

/** The settings with every trigger there (one added later gets its default). */
export const withDefaults = (s: Partial<SoundSettings> | null | undefined): SoundSettings => ({
  library: s?.library ?? [],
  triggers: { ...DEFAULT_SOUNDS.triggers, ...(s?.triggers ?? {}) },
});
