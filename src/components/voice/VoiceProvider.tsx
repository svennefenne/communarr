"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useApp, useLive, useT } from "@/components/app/AppProvider";
import { clientT } from "@/lib/i18n";

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
    local.current?.getTracks().forEach((t) => t.stop());
    local.current = null;
    meters.current.clear();
    setSpeaking(new Set());
  }, [closePeer]);

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
        if (!local.current) {
          local.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
          meter("me", local.current);
        }
        // a click starts the call: the audio may play now (iPhone)
        void actx.current?.resume();
        setMuted(false);
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
    [enter, closePeer, meter, stopAll, t],
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

  const toggleMute = useCallback(() => {
    const t = local.current?.getAudioTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setMuted(!t.enabled);
    if (roomRef.current != null) void post({ action: "mute", room: roomRef.current, conn: connRef.current, muted: !t.enabled }).catch(() => {});
  }, []);

  const toggleDeafen = useCallback(() => {
    deafRef.current = !deafRef.current;
    setDeafened(deafRef.current);
    for (const a of audios.current.values()) a.muted = deafRef.current;
    // deafened means muted too
    const t = local.current?.getAudioTracks()[0];
    if (t && deafRef.current && t.enabled) toggleMute();
  }, [toggleMute]);

  return (
    <VoiceCtx.Provider value={{ supported, room, roomName, joining, muted, deafened, error, channels, speaking, links, join, leave, toggleMute, toggleDeafen }}>
      {children}
    </VoiceCtx.Provider>
  );
}
