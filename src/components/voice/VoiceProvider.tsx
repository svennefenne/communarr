"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useApp, useLive, useT } from "@/components/app/AppProvider";
import { clientT } from "@/lib/i18n";
import { DEFAULT_VOICE_PREFS, loadVoicePrefs, openPipeline, saveVoicePrefs, type MicLevel, type NoiseMode, type Pipeline, type VoicePrefs } from "./pipeline";

/**
 * Voice chat in the browser. Joining a room's voice calls every other tab in it directly (WebRTC);
 * the set-up messages go through the server's live stream. The call stays up while you move around
 * the site, and comes back by itself if the connection to the site drops for a moment.
 */

export interface VoicePeer {
  conn: number;
  userId: number;
  muted: boolean;
  joinedAt: number;
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
  join: (room: number, name: string) => Promise<void>;
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
}

const VoiceCtx = createContext<Ctx | null>(null);
export const useVoice = () => {
  const c = useContext(VoiceCtx);
  if (!c) throw new Error("useVoice outside VoiceProvider");
  return c;
};

type Signal = { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/voice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || clientT()("Voice chat didn't answer."));
  return data;
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { conn, me, site } = useApp();
  const t = useT();
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
  useEffect(() => {
    const p = loadVoicePrefs();
    prefsRef.current = p;
    setPrefsState(p);
  }, []);

  useEffect(() => setSupported(typeof window !== "undefined" && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia && typeof RTCPeerConnection !== "undefined"), []);
  useEffect(() => {
    connRef.current = conn;
  }, [conn]);

  // who's in which channel, for everyone (the chat list shows it)
  useEffect(() => {
    if (!me || !site.features.voice) return;
    fetch("/api/voice")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setChannels(d.channels || {}))
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
    setLinks((l) => {
      const n = { ...l };
      delete n[c];
      return n;
    });
  }, []);

  const signal = useCallback((to: number, data: Signal) => {
    if (roomRef.current == null) return;
    void post({ action: "signal", room: roomRef.current, conn: connRef.current, to, data }).catch(() => {});
  }, []);

  const makePeer = useCallback(
    (c: number, initiator: boolean) => {
      closePeer(c);
      const pc = new RTCPeerConnection({ iceServers: ice.current });
      pcs.current.set(c, pc);
      local.current?.getTracks().forEach((t) => pc.addTrack(t, local.current!));
      pc.onicecandidate = (e) => e.candidate && signal(c, { candidate: e.candidate.toJSON() });
      pc.ontrack = (e) => {
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
        a.muted = deafRef.current;
        void a.play().catch(() => {});
        meter(c, stream);
      };
      pc.onconnectionstatechange = () => {
        setLinks((l) => ({ ...l, [c]: pc.connectionState }));
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
    [closePeer, signal, meter],
  );

  useLive("voiceSignal", async (d) => {
    const { room: r, from, data } = d as { room: number; from: number; data: Signal };
    if (r !== roomRef.current) return;
    let pc = pcs.current.get(from);
    if (data.sdp) {
      if (data.sdp.type === "offer") {
        if (!pc || pc.signalingState !== "stable") pc = makePeer(from, false);
        await pc.setRemoteDescription(data.sdp);
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
      const data = (await post({ action: "join", room: r, conn: connRef.current })) as { others: VoicePeer[]; ice: RTCIceServer[] };
      ice.current = data.ice;
      roomRef.current = r;
      setRoom(r);
      // the newcomer calls everyone already there
      for (const p of data.others) makePeer(p.conn, true);
      if (local.current && !local.current.getAudioTracks()[0]?.enabled) void post({ action: "mute", room: r, conn: connRef.current, muted: true }).catch(() => {});
    },
    [makePeer],
  );

  const join = useCallback(
    async (r: number, name: string) => {
      setError("");
      if (!connRef.current) {
        setError(t("Not connected to the site yet. Try again in a moment."));
        return;
      }
      setJoining(true);
      try {
        if (roomRef.current != null) {
          void post({ action: "leave", room: roomRef.current, conn: connRef.current }).catch(() => {});
          for (const c of [...pcs.current.keys()]) closePeer(c);
        }
        if (!local.current) await openMic();
        // a click starts the call: the audio may play now (iPhone)
        void actx.current?.resume();
        // (moving to another room keeps the microphone as it was: say so)
        setMuted(!(local.current?.getAudioTracks()[0]?.enabled ?? true));
        setRoomName(name);
        await enter(r);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(/Permission|NotAllowed/i.test(msg) ? t("The browser didn't allow the microphone. Allow it in the address bar's site settings.") : msg);
        stopAll();
        roomRef.current = null;
        setRoom(null);
      } finally {
        setJoining(false);
      }
    },
    [enter, closePeer, openMic, stopAll, t],
  );

  const leave = useCallback(() => {
    if (roomRef.current != null) void post({ action: "leave", room: roomRef.current, conn: connRef.current }).catch(() => {});
    roomRef.current = null;
    setRoom(null);
    setDeafened(false);
    deafRef.current = false;
    stopAll();
  }, [stopAll]);

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
    if (!t || t.enabled === on) return;
    t.enabled = on;
    setMuted(!on);
    if (roomRef.current != null) void post({ action: "mute", room: roomRef.current, conn: connRef.current, muted: !on }).catch(() => {});
  }, []);

  const setDeaf = useCallback((deaf: boolean) => {
    deafRef.current = deaf;
    setDeafened(deaf);
    for (const a of audios.current.values()) a.muted = deaf;
  }, []);

  // like Discord: deafened means muted too, hearing again puts the microphone back as it was, and
  // unmuting while deafened hears again as well
  const micBeforeDeaf = useRef(true);

  const toggleMute = useCallback(() => {
    const t = local.current?.getAudioTracks()[0];
    if (!t) return;
    if (!t.enabled && deafRef.current) setDeaf(false);
    setMic(!t.enabled);
  }, [setMic, setDeaf]);

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

  /**
   * New voice settings: kept on this device, and in a call they apply at once (a new kind of noise
   * suppression means a new microphone path, swapped into every connection without dropping the call).
   */
  const setPrefs = useCallback(
    async (next: VoicePrefs) => {
      const before = prefsRef.current;
      prefsRef.current = next;
      setPrefsState(next);
      saveVoicePrefs(next);
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
    [meter],
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

  return (
    <VoiceCtx.Provider
      value={{ supported, room, roomName, joining, muted, deafened, error, channels, speaking, links, join, leave, toggleMute, toggleDeafen, prefs, setPrefs, talkKey, processed, noiseInUse, onMicLevel }}
    >
      {children}
    </VoiceCtx.Provider>
  );
}
