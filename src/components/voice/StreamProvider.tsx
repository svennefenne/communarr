"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useApp, useLive, useT, useToast } from "@/components/app/AppProvider";
import { loadMembers } from "@/components/editor/mention";
import { useVoice, voicePost } from "./VoiceProvider";
import { encodeAs, relayed, type Quality } from "./rtc";

/**
 * Sharing a screen or a window in a call (as Discord's Go Live). Whoever goes live sends it straight to
 * each one who chooses to watch, over a connection of its own per viewer (WebRTC); the site only passes
 * the set-up messages, the call's way. When a viewer can't be reached directly, the stream may go
 * through the TURN server (Admin → Voice), and is then sent at a lower quality.
 */

export type StreamQuality = "720p30" | "1080p30" | "1080p60";
export const QUALITIES: Record<StreamQuality, Quality> = {
  "720p30": { height: 720, fps: 30, bitrate: 2_500_000 },
  "1080p30": { height: 1080, fps: 30, bitrate: 4_500_000 },
  "1080p60": { height: 1080, fps: 60, bitrate: 7_000_000 },
};
/** through a TURN server: at most this, so the site's machine isn't swamped */
const RELAYED: Quality = { height: 720, fps: 30, bitrate: 1_500_000 };

export interface StreamPrefs {
  quality: StreamQuality;
  /** motion: games and films (smooth); detail: text and code (sharp) */
  hint: "motion" | "detail";
  /** "share": the sound of what's shared (where the browser can), "none", or a sound device's id */
  audio: string;
}
const DEFAULT_PREFS: StreamPrefs = { quality: "1080p30", hint: "motion", audio: "share" };
const PREFS_KEY = "hd_stream";

function loadPrefs(): StreamPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") as Partial<StreamPrefs> | null;
    return { ...DEFAULT_PREFS, ...p, quality: p?.quality && p.quality in QUALITIES ? p.quality : DEFAULT_PREFS.quality };
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * A stream's set-up messages, passed along like the call's (each says which way it goes): the viewer
 * asks to watch, the one live offers, the viewer answers, both send their ways through (ice-s from the
 * one live, ice-v from the viewer); unwatch and end close it from either side.
 */
type Msg =
  | { stream: "watch" | "unwatch" | "end" }
  | { stream: "offer" | "answer"; sdp: RTCSessionDescriptionInit }
  | { stream: "ice-s" | "ice-v"; candidate: RTCIceCandidateInit };

/** Opus in stereo, at a music bitrate: a game's or a film's sound, not a voice. */
function stereo(sdp: string): string {
  const pt = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i)?.[1];
  if (!pt) return sdp;
  return sdp.replace(new RegExp(`a=fmtp:${pt} ([^\\r\\n]*)`), (_, params: string) =>
    `a=fmtp:${pt} ${[...params.split(";").filter((x) => x && !/^(stereo|sprop-stereo|maxaveragebitrate)=/.test(x)), "stereo=1", "sprop-stereo=1", "maxaveragebitrate=192000"].join(";")}`,
  );
}

export interface Watching {
  conn: number;
  userId: number;
  stream: MediaStream | null;
  state: "connecting" | "playing" | "failed";
  /** through the TURN server, at a lower quality */
  relayed: boolean;
  /** your own stream, as the others see it */
  self: boolean;
  error?: string;
}

interface Ctx {
  /** sharing could work here, in a call or before joining one: a computer's browser, and the site lets you */
  canGoLive: boolean;
  /** …and you're in a call */
  canShare: boolean;
  live: boolean;
  /** live with sound */
  liveAudio: boolean;
  /** the conns watching you */
  viewers: number[];
  prefs: StreamPrefs;
  goLive: (p: StreamPrefs) => Promise<void>;
  stopLive: () => void;
  watching: Watching | null;
  watch: (conn: number, userId: number) => void;
  unwatch: () => void;
  /** the video panel's webcams put away (until another one comes on, or a face with one is pressed) */
  camsHidden: boolean;
  setCamsHidden: (h: boolean) => void;
}

const StreamCtx = createContext<Ctx | null>(null);
export const useStream = () => {
  const c = useContext(StreamCtx);
  if (!c) throw new Error("useStream outside StreamProvider");
  return c;
};

export function StreamProvider({ children }: { children: React.ReactNode }) {
  const v = useVoice();
  const { conn, me, site } = useApp();
  const t = useT();
  const toast = useToast();
  const [allowed, setAllowed] = useState(false);
  const [device, setDevice] = useState(false);
  const [live, setLive] = useState(false);
  const [liveAudio, setLiveAudio] = useState(false);
  const [viewers, setViewers] = useState<number[]>([]);
  const [prefs, setPrefs] = useState<StreamPrefs>(DEFAULT_PREFS);
  const [watching, setWatching] = useState<Watching | null>(null);
  const [camsHidden, setCamsHidden] = useState(false);

  const roomRef = useRef<number | null>(null);
  const connRef = useRef<number | null>(null);
  const ice = useRef<RTCIceServer[]>([]);
  const display = useRef<MediaStream | null>(null);
  const quality = useRef<Quality>(QUALITIES[DEFAULT_PREFS.quality]);
  // yours: one connection per viewer; theirs: the one you watch
  const out = useRef(new Map<number, RTCPeerConnection>());
  const inc = useRef<{ conn: number; pc: RTCPeerConnection | null } | null>(null);
  const waiting = useRef(new Map<string, RTCIceCandidateInit[]>());
  const watchRef = useRef<Watching | null>(null);
  const retried = useRef(false);

  useEffect(() => {
    setPrefs(loadPrefs());
    // (phones and tablets can't share a screen from the browser)
    setDevice(typeof navigator.mediaDevices?.getDisplayMedia === "function" && !/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent));
  }, []);
  useEffect(() => {
    roomRef.current = v.room;
    connRef.current = conn;
  }, [v.room, conn]);

  // may streams be shared, and the servers for them (again on joining a call: Admin may have changed them)
  useEffect(() => {
    if (!me || !site.features.voice) return;
    fetch("/api/voice")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { streamIce?: RTCIceServer[]; streams?: boolean } | null) => {
        if (!d) return;
        ice.current = d.streamIce ?? [];
        setAllowed(d.streams !== false);
      })
      .catch(() => {});
  }, [v.room, me, site.features.voice]);

  const send = useCallback((to: number, data: Msg) => {
    if (roomRef.current == null) return;
    void voicePost({ action: "signal", room: roomRef.current, conn: connRef.current, to, data }).catch(() => {});
  }, []);

  const setWatch = useCallback((w: Watching | null | ((w: Watching | null) => Watching | null)) => {
    const next = typeof w === "function" ? w(watchRef.current) : w;
    watchRef.current = next;
    setWatching(next);
  }, []);

  /** Ways through that came before the other end's description: used once it's there. */
  const flush = useCallback(async (key: string, pc: RTCPeerConnection) => {
    for (const c of waiting.current.get(key) ?? []) await pc.addIceCandidate(c).catch(() => {});
    waiting.current.delete(key);
  }, []);

  // ── yours: going live, and a connection to each one who watches ──

  const dropViewer = useCallback((c: number) => {
    out.current.get(c)?.close();
    out.current.delete(c);
    waiting.current.delete(`v${c}`);
    setViewers([...out.current.keys()]);
  }, []);

  const addViewer = useCallback(
    async (c: number) => {
      const s = display.current;
      if (!s) return send(c, { stream: "end" });
      dropViewer(c);
      const pc = new RTCPeerConnection({ iceServers: ice.current });
      out.current.set(c, pc);
      setViewers([...out.current.keys()]);
      const q = quality.current;
      for (const track of s.getTracks()) {
        const h = track.kind === "video" ? (track.getSettings().height ?? q.height) : 0;
        pc.addTransceiver(track, {
          direction: "sendonly",
          streams: [s],
          sendEncodings: track.kind === "video" ? [{ maxBitrate: q.bitrate, maxFramerate: q.fps, scaleResolutionDownBy: Math.max(1, h / q.height) }] : undefined,
        });
      }
      pc.onicecandidate = (e) => e.candidate && send(c, { stream: "ice-s", candidate: e.candidate.toJSON() });
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected")
          // through the TURN server: the lower quality (checked again in a moment, the way can change)
          for (const wait of [0, 3000])
            setTimeout(() => {
              if (out.current.get(c) !== pc) return;
              void relayed(pc).then((r) => encodeAs(pc.getSenders().find((x) => x.track?.kind === "video"), r ? { height: Math.min(RELAYED.height, q.height), fps: Math.min(RELAYED.fps, q.fps), bitrate: Math.min(RELAYED.bitrate, q.bitrate) } : q));
            }, wait);
        if (pc.connectionState === "failed" || pc.connectionState === "closed") dropViewer(c);
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription({ type: "offer", sdp: stereo(offer.sdp ?? "") });
      send(c, { stream: "offer", sdp: pc.localDescription!.toJSON() });
    },
    [send, dropViewer],
  );

  const stopLive = useCallback(() => {
    for (const c of [...out.current.keys()]) {
      send(c, { stream: "end" });
      dropViewer(c);
    }
    display.current?.getTracks().forEach((tr) => tr.stop());
    display.current = null;
    setLive(false);
    setLiveAudio(false);
    if (watchRef.current?.self) setWatch(null);
    if (roomRef.current != null) void voicePost({ action: "live", room: roomRef.current, conn: connRef.current, live: false }).catch(() => {});
  }, [send, dropViewer, setWatch]);

  const goLive = useCallback(
    async (p: StreamPrefs) => {
      setPrefs(p);
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(p));
      } catch {
        /* not kept: fine */
      }
      const q = QUALITIES[p.quality];
      // the browser's own picker: the whole screen, a window (a game, a film) or a tab; with the window's
      // or the screen's sound where it can, not this tab's own (the call)
      const s = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: q.fps, max: q.fps }, height: { max: q.height }, width: { max: Math.round((q.height * 16) / 9) } },
        audio: p.audio === "share" ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false, restrictOwnAudio: true } : false,
        windowAudio: "window",
        systemAudio: "include",
        selfBrowserSurface: "exclude",
        surfaceSwitching: "include",
        monitorTypeSurfaces: "include",
      } as DisplayMediaStreamOptions);
      // the sound from a device instead (on Linux, e.g. a "Monitor of …": what the computer plays)
      if (p.audio !== "share" && p.audio !== "none") {
        const mic = await navigator.mediaDevices
          .getUserMedia({ audio: { deviceId: { exact: p.audio }, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 } })
          .catch(() => null);
        if (mic) for (const tr of mic.getAudioTracks()) s.addTrack(tr);
        else toast(t("That sound device couldn't be opened: sharing without sound."), { kind: "err" });
      }
      const video = s.getVideoTracks()[0];
      if (video) {
        video.contentHint = p.hint === "motion" ? "motion" : "detail";
        // stopped from the browser's own bar
        video.addEventListener("ended", () => display.current === s && stopLive());
      }
      display.current?.getTracks().forEach((tr) => tr.stop());
      display.current = s;
      quality.current = q;
      const audio = s.getAudioTracks().length > 0;
      setLive(true);
      setLiveAudio(audio);
      await voicePost({ action: "live", room: roomRef.current, conn: connRef.current, live: true, audio }).catch((e: Error) => {
        stopLive();
        throw e;
      });
      // already watching you: the new picture
      for (const c of [...out.current.keys()]) void addViewer(c);
    },
    [addViewer, stopLive, toast, t],
  );

  // ── theirs: watching someone ──

  const closeIncoming = useCallback(() => {
    inc.current?.pc?.close();
    if (inc.current) waiting.current.delete(`s${inc.current.conn}`);
    inc.current = null;
  }, []);

  const unwatch = useCallback(() => {
    const w = watchRef.current;
    if (w && !w.self) send(w.conn, { stream: "unwatch" });
    closeIncoming();
    setWatch(null);
  }, [send, closeIncoming, setWatch]);

  const watch = useCallback(
    (c: number, userId: number) => {
      if (watchRef.current) unwatch();
      retried.current = false;
      // your own: the picture as it is, no connection
      if (c === connRef.current) {
        if (display.current) setWatch({ conn: c, userId, stream: display.current, state: "playing", relayed: false, self: true });
        return;
      }
      inc.current = { conn: c, pc: null };
      setWatch({ conn: c, userId, stream: null, state: "connecting", relayed: false, self: false });
      send(c, { stream: "watch" });
      // nothing back: say so
      setTimeout(() => {
        if (watchRef.current?.conn === c && watchRef.current.state === "connecting" && !inc.current?.pc)
          setWatch((w) => (w ? { ...w, state: "failed", error: t("They didn't answer.") } : w));
      }, 12_000);
    },
    [send, unwatch, setWatch, t],
  );

  const onOffer = useCallback(
    async (c: number, sdp: RTCSessionDescriptionInit) => {
      if (inc.current?.conn !== c) return send(c, { stream: "unwatch" });
      inc.current.pc?.close();
      const pc = new RTCPeerConnection({ iceServers: ice.current });
      inc.current.pc = pc;
      const stream = new MediaStream();
      pc.ontrack = (e) => {
        stream.addTrack(e.track);
        setWatch((w) => (w?.conn === c ? { ...w, stream } : w));
      };
      pc.onicecandidate = (e) => e.candidate && send(c, { stream: "ice-v", candidate: e.candidate.toJSON() });
      pc.onconnectionstatechange = () => {
        if (inc.current?.pc !== pc) return;
        if (pc.connectionState === "connected") void relayed(pc).then((r) => setWatch((w) => (w?.conn === c ? { ...w, state: "playing", relayed: r, error: undefined } : w)));
        if (pc.connectionState === "failed") {
          const turn = ice.current.some((x) => [x.urls].flat().some((u) => /^turns?:/.test(u)));
          setWatch((w) => (w?.conn === c ? { ...w, state: "failed", error: turn ? t("Couldn't reach them.") : t("Couldn't reach them directly, and streams may not go through the site's server.") } : w));
        }
      };
      await pc.setRemoteDescription(sdp);
      await flush(`s${c}`, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription({ type: "answer", sdp: stereo(answer.sdp ?? "") });
      send(c, { stream: "answer", sdp: pc.localDescription!.toJSON() });
    },
    [send, flush, setWatch, t],
  );

  useLive("voiceSignal", (d) => {
    const { room: r, from, data } = d as { room: number; from: number; data: Msg };
    if (r !== roomRef.current || !data || typeof data !== "object" || !("stream" in data)) return;
    switch (data.stream) {
      case "watch":
        void addViewer(from).catch(() => dropViewer(from));
        break;
      case "unwatch":
        dropViewer(from);
        break;
      case "answer":
        void out.current
          .get(from)
          ?.setRemoteDescription(data.sdp)
          .then(() => flush(`v${from}`, out.current.get(from)!))
          .catch(() => dropViewer(from));
        break;
      case "ice-v": {
        const pc = out.current.get(from);
        if (pc?.remoteDescription) void pc.addIceCandidate(data.candidate).catch(() => {});
        else waiting.current.set(`v${from}`, [...(waiting.current.get(`v${from}`) ?? []), data.candidate]);
        break;
      }
      case "offer":
        void onOffer(from, data.sdp).catch(() => setWatch((w) => (w?.conn === from ? { ...w, state: "failed", error: t("Couldn't reach them.") } : w)));
        break;
      case "ice-s": {
        const pc = inc.current?.conn === from ? inc.current.pc : null;
        if (pc?.remoteDescription) void pc.addIceCandidate(data.candidate).catch(() => {});
        else waiting.current.set(`s${from}`, [...(waiting.current.get(`s${from}`) ?? []), data.candidate]);
        break;
      }
      case "end":
        if (watchRef.current?.conn === from) {
          closeIncoming();
          setWatch(null);
        }
        break;
    }
  });

  // a tab left the call: its stream to you, or yours to it, is over
  useLive("voiceGone", (d) => {
    const { room: r, conn: c } = d as { room: number; conn: number };
    if (r !== roomRef.current) return;
    dropViewer(c);
    if (watchRef.current?.conn === c) {
      closeIncoming();
      setWatch(null);
    }
  });

  // out of the call (or into another): no more sharing or watching
  useEffect(() => {
    if (v.room != null) return;
    if (display.current) stopLive();
    if (watchRef.current) {
      closeIncoming();
      setWatch(null);
    }
  }, [v.room, stopLive, closeIncoming, setWatch]);
  const lastRoom = useRef<number | null>(null);
  useEffect(() => {
    if (lastRoom.current != null && v.room != null && v.room !== lastRoom.current) {
      if (display.current) stopLive();
      if (watchRef.current) {
        closeIncoming();
        setWatch(null);
      }
    }
    lastRoom.current = v.room;
  }, [v.room, stopLive, closeIncoming, setWatch]);

  const peers = v.room != null ? (v.channels[v.room] ?? []) : [];
  const liveKey = peers.map((p) => `${p.conn}:${p.live ? 1 : 0}`).join(",");

  // what the channel says: the one you watch stopped; you're live but the site lost it (back after a
  // reconnect); someone else went live (say so)
  const seenLive = useRef(new Set<number>());
  useEffect(() => {
    const w = watchRef.current;
    if (w && !w.self && !peers.some((p) => p.conn === w.conn && p.live)) {
      closeIncoming();
      setWatch(null);
    }
    const mine = peers.find((p) => p.conn === connRef.current);
    if (display.current && mine && !mine.live) void voicePost({ action: "live", room: roomRef.current, conn: connRef.current, live: true, audio: display.current.getAudioTracks().length > 0 }).catch(() => {});
    const now = new Set(peers.filter((p) => p.live).map((p) => p.conn));
    for (const p of peers)
      if (p.live && !seenLive.current.has(p.conn) && p.conn !== connRef.current)
        void loadMembers().then((list) => toast(t("{name} is sharing their screen: press LIVE in the call to watch.", { name: list.find((u) => u.id === p.userId)?.name ?? t("Someone") })));
    seenLive.current = now;
    // (the list of peers is what's in liveKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey]);

  // a webcam comes on in the call (yours too): the panel shows them again
  const camKey = peers
    .filter((p) => p.camera)
    .map((p) => p.conn)
    .join(",");
  const seenCams = useRef(new Set<number>());
  useEffect(() => {
    const now = new Set(peers.filter((p) => p.camera).map((p) => p.conn));
    if ([...now].some((c) => !seenCams.current.has(c))) setCamsHidden(false);
    seenCams.current = now;
    // (the cameras on are what's in camKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camKey]);

  // the stream you watch broke: once more, if they're still live
  useEffect(() => {
    if (watching?.state !== "failed" || retried.current || watching.self) return;
    const { conn: c, userId } = watching;
    if (!peers.some((p) => p.conn === c && p.live)) return;
    retried.current = true;
    const id = setTimeout(() => {
      if (watchRef.current?.conn !== c) return;
      closeIncoming();
      inc.current = { conn: c, pc: null };
      setWatch({ conn: c, userId, stream: null, state: "connecting", relayed: false, self: false });
      send(c, { stream: "watch" });
    }, 1500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watching?.state]);

  // leaving the page stops it all (the browser ends the capture itself)
  useEffect(() => () => display.current?.getTracks().forEach((tr) => tr.stop()), []);

  return (
    <StreamCtx.Provider value={{ canGoLive: device && allowed, canShare: device && allowed && v.room != null, live, liveAudio, viewers, prefs, goLive, stopLive, watching, watch, unwatch, camsHidden, setCamsHidden }}>{children}</StreamCtx.Provider>
  );
}
