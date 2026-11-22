"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useApp, useLive, useT, useToast } from "@/components/app/AppProvider";
import { clientT } from "@/lib/i18n";
import { DEFAULT_VOICE_PREFS, loadVoicePrefs, openPipeline, saveVoicePrefs, type CameraQuality, type MicLevel, type NoiseMode, type Pipeline, type VoicePrefs } from "./pipeline";
import { encodeAs, relayed, type Quality } from "./rtc";
import { inAndroidApp, inDesktopApp } from "@/components/app/androidApp";

/**
 * Voice chat in the browser. Joining a room's voice calls every other tab in it directly (WebRTC);
 * the set-up messages go through the server's live stream. The call stays up while you move around
 * the site, and comes back by itself if the connection to the site drops for a moment.
 *
 * A webcam goes over the same connections: each has a video way from the start that sends nothing
 * while yours is off, so turning it on or off needs no new offer.
 */

/** A webcam to each one in the call, straight to them; through a TURN server always small. */
export const CAMERA: Record<CameraQuality, Quality> = {
  "360p": { height: 360, fps: 24, bitrate: 600_000 },
  "720p": { height: 720, fps: 30, bitrate: 1_500_000 },
  "1080p": { height: 1080, fps: 30, bitrate: 3_000_000 },
};
const CAMERA_RELAYED: Quality = { height: 180, fps: 15, bitrate: 150_000 };
const videoOf = (pc: RTCPeerConnection) => pc.getTransceivers().find((tr) => tr.receiver.track.kind === "video");

export interface VoicePeer {
  conn: number;
  userId: number;
  muted: boolean;
  joinedAt: number;
  /** sharing their screen or a window (StreamProvider) */
  live: { since: number; audio: boolean } | null;
  /** their webcam is on */
  camera: boolean;
  /** they hear nothing */
  deaf: boolean;
  /** silenced by a room admin */
  held: boolean;
}

/** How someone in a call sounds to you (kept on this device): their volume (0–1), or off for you. */
export interface PersonAudio {
  vol: number;
  off: boolean;
}
const PEOPLE_KEY = "hd_voice_people";
function loadPeople(): Record<number, PersonAudio> {
  try {
    const v = JSON.parse(localStorage.getItem(PEOPLE_KEY) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

interface Ctx {
  supported: boolean;
  /** the room you're talking in */
  room: number | null;
  roomName: string;
  joining: boolean;
  muted: boolean;
  deafened: boolean;
  error: string;
  /** everyone in each room's voice (live) */
  channels: Record<number, VoicePeer[]>;
  /** conns (yours: "me") that are talking right now */
  speaking: Set<number | "me">;
  links: Record<number, RTCPeerConnectionState>;
  /** into a room's voice (false: it didn't work, and `error` says why) */
  join: (room: number, name: string) => Promise<boolean>;
  leave: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  /** your voice settings on this device (push to talk, noise suppression, input sensitivity) */
  prefs: VoicePrefs;
  setPrefs: (p: VoicePrefs) => Promise<void>;
  /** push to talk: the key is held */
  talkKey: boolean;
  /** in a call: what the microphone path can do here (no audio worklets: no sensitivity or push to talk) */
  processed: boolean;
  noiseInUse: NoiseMode;
  /** in a call: how loud the microphone is (for the meter) */
  onMicLevel: (fn: (l: MicLevel) => void) => () => void;
  /** webcams may be on (Admin → Voice) */
  camerasAllowed: boolean;
  /** your webcam, while it's on */
  camera: MediaStream | null;
  /** the others' webcams by conn (to show while their peer says camera) */
  cameras: Record<number, MediaStream>;
  /** your webcam on or off, in a call */
  toggleCamera: () => Promise<void>;
  cameraBusy: boolean;
  /** a room admin has silenced you in the call: the microphone stays off */
  held: boolean;
  /** how each one sounds to you, by user (on this device) */
  people: Record<number, PersonAudio>;
  setPersonAudio: (userId: number, a: Partial<PersonAudio>) => void;
  /** a room admin's: silence someone in a room's voice (or let them talk), disconnect them, or everyone */
  moderate: (room: number, what: { hold: number; held: boolean } | { kick: number } | "kickAll") => Promise<boolean>;
}

const VoiceCtx = createContext<Ctx | null>(null);
export const useVoice = () => {
  const c = useContext(VoiceCtx);
  if (!c) throw new Error("useVoice outside VoiceProvider");
  return c;
};
/** The call as it is when asked (a menu opening), without drawing again each time someone starts talking. */
const VoiceNowCtx = createContext<{ current: Ctx | null }>({ current: null });
export const useVoiceNow = () => useContext(VoiceNowCtx);

type Signal = { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

export async function voicePost(body: Record<string, unknown>) {
  const res = await fetch("/api/voice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || clientT()("Voice chat didn't answer."));
  return data;
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { conn, me, site } = useApp();
  const t = useT();
  const toast = useToast();
  const [supported, setSupported] = useState(false);
  const [room, setRoom] = useState<number | null>(null);
  const [roomName, setRoomName] = useState("");
  const [joining, setJoining] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [error, setError] = useState("");
  const [channels, setChannels] = useState<Record<number, VoicePeer[]>>({});
  const [speaking, setSpeaking] = useState<Set<number | "me">>(new Set());
  const [links, setLinks] = useState<Record<number, RTCPeerConnectionState>>({});

  const roomRef = useRef<number | null>(null);
  const connRef = useRef<number | null>(null);
  const local = useRef<MediaStream | null>(null);
  const ice = useRef<RTCIceServer[]>([]);
  const pcs = useRef(new Map<number, RTCPeerConnection>());
  const pending = useRef(new Map<number, RTCIceCandidateInit[]>());
  const audios = useRef(new Map<number, HTMLAudioElement>());
  const meters = useRef(new Map<number | "me", AnalyserNode>());
  const actx = useRef<AudioContext | null>(null);
  const deafRef = useRef(false);
  // the microphone's path (noise suppression, sensitivity, push to talk) and your settings for it
  const pipe = useRef<Pipeline | null>(null);
  const [prefs, setPrefsState] = useState<VoicePrefs>(DEFAULT_VOICE_PREFS);
  const prefsRef = useRef<VoicePrefs>(DEFAULT_VOICE_PREFS);
  const [talkKey, setTalkKey] = useState(false);
  const talkRef = useRef(false);
  const [processed, setProcessed] = useState(true);
  const [noiseInUse, setNoiseInUse] = useState<NoiseMode>("browser");
  // your webcam, and the others'
  const [camerasAllowed, setCamerasAllowed] = useState(false);
  const [camera, setCamera] = useState<MediaStream | null>(null);
  const camRef = useRef<MediaStream | null>(null);
  const [cameras, setCameras] = useState<Record<number, MediaStream>>({});
  const [cameraBusy, setCameraBusy] = useState(false);
  const [held, setHeld] = useState(false);
  const heldRef = useRef(false);
  const [people, setPeople] = useState<Record<number, PersonAudio>>({});
  const peopleRef = useRef<Record<number, PersonAudio>>({});
  const channelsRef = useRef<Record<number, VoicePeer[]>>({});
  useEffect(() => {
    const p = loadPeople();
    peopleRef.current = p;
    setPeople(p);
  }, []);
  useEffect(() => {
    const p = loadVoicePrefs();
    prefsRef.current = p;
    setPrefsState(p);
  }, []);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia && typeof RTCPeerConnection !== "undefined");
  }, []);
  useEffect(() => {
    connRef.current = conn;
  }, [conn]);

  // who's in which channel, for everyone (the chat list shows it)
  useEffect(() => {
    if (!me || !site.features.voice) return;
    fetch("/api/voice")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setChannels(d.channels || {});
        setCamerasAllowed(d.cameras !== false);
      })
      .catch(() => {});
  }, [me, site.features.voice]);
  useLive("voiceState", (d) => {
    const { room: r, peers } = d as { room: number; peers: VoicePeer[] };
    setChannels((c) => {
      const n = { ...c };
      if (peers.length) n[r] = peers;
      else delete n[r];
      return n;
    });
  });

  const meter = useCallback((key: number | "me", stream: MediaStream) => {
    try {
      actx.current ??= new AudioContext();
      const src = actx.current.createMediaStreamSource(stream);
      const an = actx.current.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      meters.current.set(key, an);
    } catch {
      /* no meter, no matter */
    }
  }, []);

  /** Each one's sound as you want it: off while you're deafened, they're off for you, or a room admin silenced them; at their volume. */
  const applyAudio = useCallback(() => {
    const peers = roomRef.current == null ? [] : channelsRef.current[roomRef.current] ?? [];
    for (const [c, a] of audios.current) {
      const p = peers.find((x) => x.conn === c);
      const mine = p ? peopleRef.current[p.userId] : undefined;
      a.muted = deafRef.current || !!mine?.off || !!p?.held;
      a.volume = Math.max(0, Math.min(1, mine?.vol ?? 1));
    }
  }, []);
  useEffect(() => {
    channelsRef.current = channels;
    applyAudio();
  }, [channels, applyAudio]);

  const setPersonAudio = useCallback(
    (userId: number, a: Partial<PersonAudio>) => {
      const had: PersonAudio = peopleRef.current[userId] ?? { vol: 1, off: false };
      const next = { ...peopleRef.current, [userId]: { ...had, ...a } };
      // (as it comes: nothing to keep)
      if (next[userId].vol === 1 && !next[userId].off) delete next[userId];
      peopleRef.current = next;
      setPeople(next);
      try {
        localStorage.setItem(PEOPLE_KEY, JSON.stringify(next));
      } catch {
        /* kept for now only */
      }
      applyAudio();
    },
    [applyAudio],
  );

  // who's talking: the loudness of each stream, ten times a second
  useEffect(() => {
    if (room == null) return;
    const buf = new Uint8Array(512);
    const id = setInterval(() => {
      const now = new Set<number | "me">();
      for (const [k, an] of meters.current) {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += (v - 128) * (v - 128);
        if (Math.sqrt(sum / buf.length) > 6 && !(k === "me" && local.current?.getAudioTracks()[0]?.enabled === false)) now.add(k);
      }
      setSpeaking((prev) => (prev.size === now.size && [...now].every((x) => prev.has(x)) ? prev : now));
    }, 100);
    return () => clearInterval(id);
  }, [room]);

  const closePeer = useCallback((c: number) => {
    pcs.current.get(c)?.close();
    pcs.current.delete(c);
    pending.current.delete(c);
    const a = audios.current.get(c);
    if (a) {
      a.srcObject = null;
      a.remove();
    }
    audios.current.delete(c);
    meters.current.delete(c);
    setCameras((m) => {
      if (!(c in m)) return m;
      const n = { ...m };
      delete n[c];
      return n;
    });
    setLinks((l) => {
      const n = { ...l };
      delete n[c];
      return n;
    });
  }, []);

  const signal = useCallback((to: number, data: Signal) => {
    if (roomRef.current == null) return;
    void voicePost({ action: "signal", room: roomRef.current, conn: connRef.current, to, data }).catch(() => {});
  }, []);

  /** Your webcam into a call's connection (or out of it: null), at the size its way allows. */
  const sendCamera = useCallback(async (pc: RTCPeerConnection) => {
    const tr = videoOf(pc);
    if (!tr || tr.currentDirection === "stopped") return;
    const track = camRef.current?.getVideoTracks()[0] ?? null;
    await tr.sender.replaceTrack(track).catch(() => {});
    if (track) await encodeAs(tr.sender, (await relayed(pc)) ? CAMERA_RELAYED : CAMERA[prefsRef.current.cameraQuality]);
  }, []);

  const makePeer = useCallback(
    (c: number, initiator: boolean) => {
      closePeer(c);
      const pc = new RTCPeerConnection({ iceServers: ice.current });
      pcs.current.set(c, pc);
      local.current?.getTracks().forEach((t) => pc.addTrack(t, local.current!));
      // the webcam's way, there from the start (the one called says yes to it in the answer)
      if (initiator) pc.addTransceiver(camRef.current?.getVideoTracks()[0] ?? "video", { direction: "sendrecv" });
      pc.onicecandidate = (e) => e.candidate && signal(c, { candidate: e.candidate.toJSON() });
      pc.ontrack = (e) => {
        // a webcam: kept for the video panel, never into the voice's audio
        if (e.track.kind === "video") {
          const cam = new MediaStream([e.track]);
          setCameras((m) => ({ ...m, [c]: cam }));
          return;
        }
        const stream = e.streams[0] ?? new MediaStream([e.track]);
        let a = audios.current.get(c);
        if (!a) {
          a = document.createElement("audio");
          a.autoplay = true;
          a.setAttribute("playsinline", "");
          a.style.display = "none";
          document.body.appendChild(a);
          audios.current.set(c, a);
        }
        a.srcObject = stream;
        applyAudio();
        void a.play().catch(() => {});
        meter(c, stream);
      };
      pc.onconnectionstatechange = () => {
        setLinks((l) => ({ ...l, [c]: pc.connectionState }));
        // the webcam at the size the way allows: straight, or the TURN server's smaller (checked again
        // in a moment: the way is often only known then, and can change)
        if (pc.connectionState === "connected") for (const wait of [0, 3000]) setTimeout(() => pcs.current.get(c) === pc && void sendCamera(pc), wait);
        // the caller tries again if the line breaks
        if (pc.connectionState === "failed" && initiator) {
          pc.restartIce();
          pc.createOffer({ iceRestart: true })
            .then((o) => pc.setLocalDescription(o))
            .then(() => signal(c, { sdp: pc.localDescription!.toJSON() }))
            .catch(() => {});
        }
      };
      if (initiator) {
        pc.createOffer()
          .then((o) => pc.setLocalDescription(o))
          .then(() => signal(c, { sdp: pc.localDescription!.toJSON() }))
          .catch(() => {});
      }
      return pc;
    },
    [closePeer, signal, meter, sendCamera, applyAudio],
  );

  useLive("voiceSignal", async (d) => {
    const { room: r, from, data } = d as { room: number; from: number; data: Signal };
    // (a stream's are StreamProvider's)
    if (r !== roomRef.current || "stream" in data) return;
    let pc = pcs.current.get(from);
    if (data.sdp) {
      if (data.sdp.type === "offer") {
        if (!pc || pc.signalingState !== "stable") pc = makePeer(from, false);
        await pc.setRemoteDescription(data.sdp);
        // the webcam's way: both ways, with yours on it if it's on
        const tv = videoOf(pc);
        if (tv) {
          tv.direction = "sendrecv";
          await tv.sender.replaceTrack(camRef.current?.getVideoTracks()[0] ?? null).catch(() => {});
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        signal(from, { sdp: pc.localDescription!.toJSON() });
      } else if (pc) await pc.setRemoteDescription(data.sdp).catch(() => {});
      for (const cand of pending.current.get(from) ?? []) await pc?.addIceCandidate(cand).catch(() => {});
      pending.current.delete(from);
    } else if (data.candidate) {
      if (pc?.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {});
      else pending.current.set(from, [...(pending.current.get(from) ?? []), data.candidate]);
    }
  });

  useLive("voiceGone", (d) => {
    const { room: r, conn: c } = d as { room: number; conn: number };
    if (r === roomRef.current) closePeer(c);
  });

  const stopAll = useCallback(() => {
    for (const c of [...pcs.current.keys()]) closePeer(c);
    pipe.current?.close();
    pipe.current = null;
    local.current?.getTracks().forEach((t) => t.stop());
    local.current = null;
    camRef.current?.getTracks().forEach((t) => t.stop());
    camRef.current = null;
    setCamera(null);
    setCameras({});
    meters.current.clear();
    setSpeaking(new Set());
    talkRef.current = false;
    setTalkKey(false);
  }, [closePeer]);

  /** The microphone through your settings, ready for a call. */
  const openMic = useCallback(async () => {
    const p = await openPipeline(prefsRef.current);
    pipe.current = p;
    local.current = p.stream;
    setProcessed(p.processed);
    setNoiseInUse(p.noise);
    meter("me", p.stream);
    return p;
  }, [meter]);

  const enter = useCallback(
    async (r: number) => {
      const data = (await voicePost({ action: "join", room: r, conn: connRef.current })) as { others: VoicePeer[]; ice: RTCIceServer[]; cameras?: boolean };
      ice.current = data.ice;
      setCamerasAllowed(data.cameras !== false);
      roomRef.current = r;
      setRoom(r);
      // the newcomer calls everyone already there
      for (const p of data.others) makePeer(p.conn, true);
      if (local.current && !local.current.getAudioTracks()[0]?.enabled) void voicePost({ action: "mute", room: r, conn: connRef.current, muted: true }).catch(() => {});
      if (deafRef.current) void voicePost({ action: "deafen", room: r, conn: connRef.current, deaf: true }).catch(() => {});
      // (moving to another room, or back after a reconnect: the webcam stays on)
      if (camRef.current) void voicePost({ action: "camera", room: r, conn: connRef.current, on: true }).catch(() => {});
    },
    [makePeer],
  );

  const join = useCallback(
    async (r: number, name: string) => {
      setError("");
      if (!connRef.current) {
        setError(t("Not connected to the site yet. Try again in a moment."));
        return false;
      }
      setJoining(true);
      try {
        if (roomRef.current != null) {
          void voicePost({ action: "leave", room: roomRef.current, conn: connRef.current }).catch(() => {});
          for (const c of [...pcs.current.keys()]) closePeer(c);
        }
        if (!local.current) await openMic();
        // a click starts the call: the audio may play now (iPhone)
        void actx.current?.resume();
        // (moving to another room keeps the microphone as it was: say so)
        setMuted(!(local.current?.getAudioTracks()[0]?.enabled ?? true));
        setRoomName(name);
        await enter(r);
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // (in the Android app there's no address bar: Android's own settings)
        setError(/Permission|NotAllowed/i.test(msg) ? (inAndroidApp() ? t("The app may not use the microphone. Allow it for the app in Android's settings, under Permissions.") : inDesktopApp() ? t("The computer didn't let the app use the microphone. Allow it in the system's privacy settings.") : t("The browser didn't allow the microphone. Allow it in the address bar's site settings.")) : msg);
        stopAll();
        roomRef.current = null;
        setRoom(null);
        return false;
      } finally {
        setJoining(false);
      }
    },
    [enter, closePeer, openMic, stopAll, t],
  );

  /** Out of the call here (told: the server has you out already). */
  const hangUp = useCallback(() => {
    roomRef.current = null;
    setRoom(null);
    setDeafened(false);
    deafRef.current = false;
    heldRef.current = false;
    setHeld(false);
    stopAll();
  }, [stopAll]);

  const leave = useCallback(() => {
    if (roomRef.current != null) void voicePost({ action: "leave", room: roomRef.current, conn: connRef.current }).catch(() => {});
    hangUp();
  }, [hangUp]);

  // a room admin disconnected you (or you were taken out of the room)
  useLive("voiceKicked", (d) => {
    const { room: r } = d as { room: number };
    if (r !== roomRef.current) return;
    hangUp();
    toast(t("You were disconnected from the voice chat."));
  });

  // the live stream reconnected (a new conn): back into the channel
  const lastConn = useRef<number | null>(null);
  useEffect(() => {
    if (conn && lastConn.current && conn !== lastConn.current && roomRef.current != null) {
      for (const c of [...pcs.current.keys()]) closePeer(c);
      void enter(roomRef.current).catch(() => leave());
    }
    if (conn) lastConn.current = conn;
  }, [conn, enter, closePeer, leave]);

  // leaving the site leaves the channel
  useEffect(() => {
    const bye = () => {
      if (roomRef.current != null && connRef.current) navigator.sendBeacon?.("/api/voice", new Blob([JSON.stringify({ action: "leave", room: roomRef.current, conn: connRef.current })], { type: "application/json" }));
    };
    window.addEventListener("pagehide", bye);
    return () => window.removeEventListener("pagehide", bye);
  }, []);

  const setMic = useCallback((on: boolean) => {
    const t = local.current?.getAudioTracks()[0];
    // (silenced by a room admin: it stays off)
    if (!t || t.enabled === on || (on && heldRef.current)) return;
    t.enabled = on;
    setMuted(!on);
    if (roomRef.current != null) void voicePost({ action: "mute", room: roomRef.current, conn: connRef.current, muted: !on }).catch(() => {});
  }, []);

  const setDeaf = useCallback(
    (deaf: boolean) => {
      deafRef.current = deaf;
      setDeafened(deaf);
      applyAudio();
      if (roomRef.current != null) void voicePost({ action: "deafen", room: roomRef.current, conn: connRef.current, deaf }).catch(() => {});
    },
    [applyAudio],
  );

  // silenced by a room admin (or let talk again): from your own place in the channel, so coming back keeps it
  useEffect(() => {
    const mine = room == null ? undefined : channels[room]?.find((p) => p.conn === conn);
    const now = !!mine?.held;
    if (now === heldRef.current) return;
    heldRef.current = now;
    setHeld(now);
    const tr = local.current?.getAudioTracks()[0];
    if (now && tr?.enabled) {
      tr.enabled = false;
      setMuted(true);
    }
  }, [channels, room, conn]);
  useLive("voiceHeld", (d) => {
    const { room: r, held: on } = d as { room: number; held: boolean };
    if (r === roomRef.current) toast(on ? t("A room admin has silenced you in the voice chat.") : t("You may talk again."));
  });

  const moderate = useCallback(
    async (r: number, what: { hold: number; held: boolean } | { kick: number } | "kickAll") => {
      try {
        if (what === "kickAll") await voicePost({ action: "kickAll", room: r });
        else if ("kick" in what) await voicePost({ action: "kick", room: r, user: what.kick });
        else await voicePost({ action: "hold", room: r, user: what.hold, held: what.held });
        return true;
      } catch (e) {
        toast(e instanceof Error ? e.message : String(e), { kind: "err" });
        return false;
      }
    },
    [toast],
  );

  // like Discord: deafened means muted too, hearing again puts the microphone back as it was, and
  // unmuting while deafened hears again as well
  const micBeforeDeaf = useRef(true);

  const toggleMute = useCallback(() => {
    const t = local.current?.getAudioTracks()[0];
    if (!t) return;
    if (!t.enabled && heldRef.current) {
      toast(clientT()("A room admin has silenced you in the voice chat."));
      return;
    }
    if (!t.enabled && deafRef.current) setDeaf(false);
    setMic(!t.enabled);
  }, [setMic, setDeaf, toast]);

  const toggleDeafen = useCallback(() => {
    if (!deafRef.current) {
      micBeforeDeaf.current = local.current?.getAudioTracks()[0]?.enabled ?? true;
      setDeaf(true);
      setMic(false);
    } else {
      setDeaf(false);
      if (micBeforeDeaf.current) setMic(true);
    }
  }, [setMic, setDeaf]);

  /** The webcam from your settings, as large as its quality asks (the browser picks the nearest it has). */
  const openCamera = useCallback(async () => {
    const p = prefsRef.current;
    const h = CAMERA[p.cameraQuality].height;
    const s = await navigator.mediaDevices.getUserMedia({
      video: { ...(p.camera ? { deviceId: { ideal: p.camera } } : {}), height: { ideal: h }, width: { ideal: Math.round((h * 16) / 9) }, frameRate: { ideal: CAMERA[p.cameraQuality].fps, max: 30 } },
    });
    const track = s.getVideoTracks()[0];
    if (track) track.contentHint = "motion";
    return s;
  }, []);

  const cameraOff = useCallback(() => {
    camRef.current?.getTracks().forEach((tr) => tr.stop());
    camRef.current = null;
    setCamera(null);
    for (const pc of pcs.current.values()) void sendCamera(pc);
    if (roomRef.current != null) void voicePost({ action: "camera", room: roomRef.current, conn: connRef.current, on: false }).catch(() => {});
  }, [sendCamera]);

  /** Your webcam into every connection of the call at once (no new offers), and the others told. */
  const cameraOn = useCallback(async () => {
    if (roomRef.current == null || camRef.current) return;
    setCameraBusy(true);
    try {
      const s = await openCamera();
      // unplugged, or taken by another app
      s.getVideoTracks()[0]?.addEventListener("ended", () => camRef.current === s && cameraOff());
      camRef.current = s;
      setCamera(s);
      for (const pc of pcs.current.values()) void sendCamera(pc);
      await voicePost({ action: "camera", room: roomRef.current, conn: connRef.current, on: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (camRef.current) cameraOff();
      const denied = inAndroidApp()
        ? t("The app may not use the camera. Allow it for the app in Android's settings, under Permissions.")
        : inDesktopApp()
          ? t("The computer didn't let the app use the camera. Allow it in the system's privacy settings.")
          : t("The browser didn't allow the camera. Allow it in the address bar's site settings.");
      toast(/Permission|NotAllowed/i.test(msg) ? denied : /NotFound|not found/i.test(msg) ? t("No camera found.") : msg, { kind: "err" });
    } finally {
      setCameraBusy(false);
    }
  }, [openCamera, cameraOff, sendCamera, toast, t]);

  const toggleCamera = useCallback(() => (camRef.current ? Promise.resolve(cameraOff()) : cameraOn()), [cameraOn, cameraOff]);

  /**
   * New voice settings: kept on this device, and in a call they apply at once (a new kind of noise
   * suppression means a new microphone path, swapped into every connection without dropping the call;
   * another webcam or quality, the webcam swapped the same way).
   */
  const setPrefs = useCallback(
    async (next: VoicePrefs) => {
      const before = prefsRef.current;
      prefsRef.current = next;
      setPrefsState(next);
      saveVoicePrefs(next);
      if (camRef.current && (next.camera !== before.camera || next.cameraQuality !== before.cameraQuality)) {
        const old = camRef.current;
        const fresh = await openCamera().catch(() => null);
        if (fresh && camRef.current === old) {
          fresh.getVideoTracks()[0]?.addEventListener("ended", () => camRef.current === fresh && cameraOff());
          camRef.current = fresh;
          setCamera(fresh);
          for (const pc of pcs.current.values()) await sendCamera(pc);
          old.getTracks().forEach((tr) => tr.stop());
        } else fresh?.getTracks().forEach((tr) => tr.stop());
      }
      const p = pipe.current;
      if (!p) return;
      if (next.noise !== before.noise) {
        const wasOn = local.current?.getAudioTracks()[0]?.enabled ?? true;
        const fresh = await openPipeline(next).catch(() => null);
        if (!fresh) return;
        const track = fresh.stream.getAudioTracks()[0];
        if (track) track.enabled = wasOn;
        for (const pc of pcs.current.values()) await pc.getSenders().find((s) => s.track?.kind === "audio")?.replaceTrack(track ?? null).catch(() => {});
        p.close();
        pipe.current = fresh;
        local.current = fresh.stream;
        setProcessed(fresh.processed);
        setNoiseInUse(fresh.noise);
        meter("me", fresh.stream);
      }
      const cur = pipe.current!;
      cur.setThreshold(next.threshold);
      cur.setForce(next.mode === "ptt" ? (talkRef.current ? 1 : -1) : 0);
    },
    [meter, openCamera, cameraOff, sendCamera],
  );

  // push to talk: while in a call, the key held down opens the microphone (not while typing in a field)
  useEffect(() => {
    if (room == null || prefs.mode !== "ptt") return;
    const typing = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    const set = (down: boolean) => {
      if (talkRef.current === down) return;
      talkRef.current = down;
      setTalkKey(down);
      pipe.current?.setForce(down ? 1 : -1);
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== prefs.key || e.repeat || typing(e.target)) return;
      e.preventDefault();
      set(true);
    };
    const onUp = (e: KeyboardEvent) => e.code === prefs.key && set(false);
    // a key let go in another window never comes back up here
    const onBlur = () => set(false);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      set(false);
    };
  }, [room, prefs.mode, prefs.key]);

  const onMicLevel = useCallback((fn: (l: MicLevel) => void) => pipe.current?.onLevel(fn) ?? (() => {}), []);

  const value: Ctx = { supported, room, roomName, joining, muted, deafened, error, channels, speaking, links, join, leave, toggleMute, toggleDeafen, prefs, setPrefs, talkKey, processed, noiseInUse, onMicLevel, camerasAllowed, camera, cameras, toggleCamera, cameraBusy, held, people, setPersonAudio, moderate };
  const now = useRef<Ctx | null>(null);
  useEffect(() => {
    now.current = value;
  });
  return (
    <VoiceNowCtx.Provider value={now}>
      <VoiceCtx.Provider value={value}>{children}</VoiceCtx.Provider>
    </VoiceNowCtx.Provider>
  );
}
