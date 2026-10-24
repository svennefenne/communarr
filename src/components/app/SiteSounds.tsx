"use client";

import { useEffect, useRef } from "react";
import { useApp, useLive } from "@/components/app/AppProvider";
import { useVoice } from "@/components/voice/VoiceProvider";
import { playSound, setSoundsOn, soundsOn, unlockSounds } from "./sfx";
import type { SoundTrigger } from "@/lib/sounds";

/** at most one of each in this long (ms): a busy chat or a flood of joins stays bearable */
const GAP: Record<SoundTrigger, number> = { online: 2000, voiceJoin: 300, voiceLeave: 300, post: 1500, message: 1500, event: 1500, poll: 1500 };

/**
 * The site's sounds (Admin → Sounds), played for what others do: someone coming online, joining or
 * leaving the voice chat you're in, a new post, event or poll you can see, a message in one of your
 * rooms (not the one you're looking at, nor one you muted). Not while the member has Sounds off.
 */
export function SiteSounds() {
  const { me, site, presence, conn } = useApp();
  const voice = useVoice();
  const last = useRef(new Map<string, number>());
  const presenceRef = useRef(presence);
  presenceRef.current = presence;
  // (right after (re)connecting, everyone's "comes online" is just the site catching up)
  const since = useRef(Date.now());
  useEffect(() => {
    since.current = Date.now();
  }, [conn]);
  useEffect(() => unlockSounds(), []);
  useEffect(() => setSoundsOn(me?.theme.sounds !== false), [me?.theme.sounds]);

  const play = (trigger: SoundTrigger, key: string = trigger) => {
    const s = site.sounds;
    if (!s || !soundsOn()) return;
    const now = Date.now();
    if (now - (last.current.get(key) ?? 0) < GAP[trigger]) return;
    last.current.set(key, now);
    const ts = s.triggers[trigger];
    if (ts?.sound) void playSound(ts.sound, ts.volume, s.library);
  };

  useLive("presence", (d) => {
    const { id, state } = d as { id: number; state: string };
    if (!me || id === me.id || state === "offline" || Date.now() - since.current < 5000) return;
    if ((presenceRef.current.get(id) ?? "offline") !== "offline") return;
    // the same person flickering on and off: once a minute
    if (Date.now() - (last.current.get(`online:${id}`) ?? 0) < 60_000) return;
    last.current.set(`online:${id}`, Date.now());
    play("online");
  });

  useLive("feed", (d) => {
    const e = d as { type: string; by: number; group: number | null };
    if (!me || e.by === me.id) return;
    // a group's: only for its members
    if (e.group && !me.groups.includes(e.group)) return;
    if (e.type === "event") play("event");
    else if (e.type === "poll") play("poll");
    else play("post");
  });

  useLive("unread", (d) => {
    const e = d as { room: number; new?: boolean; quiet?: boolean };
    if (e.new && !e.quiet) play("message");
  });

  // the voice chat you're in: who came, who went (not you, and not the ones there when you came in)
  const seen = useRef<{ room: number | null; conns: Set<number> }>({ room: null, conns: new Set() });
  useEffect(() => {
    const room = voice.room;
    const now = new Set((room != null ? (voice.channels[room] ?? []) : []).map((p) => p.conn).filter((c) => c !== conn));
    const before = seen.current;
    seen.current = { room, conns: now };
    if (room == null || before.room !== room) return;
    if ([...now].some((c) => !before.conns.has(c))) play("voiceJoin");
    else if ([...before.conns].some((c) => !now.has(c))) play("voiceLeave");
    // (play is the same each time; what changes is who's in the channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.room, voice.channels, conn]);

  return null;
}
