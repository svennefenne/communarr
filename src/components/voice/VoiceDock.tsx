"use client";

import Link from "next/link";
import { Headphones, HeadphoneOff, Mic, MicOff, PhoneOff, Radio } from "lucide-react";
import { useVoice, type VoicePeer } from "./VoiceProvider";
import { useApp } from "@/components/app/AppProvider";
import { useMembers } from "@/components/app/useMembers";
import { Avatar } from "@/components/ui/Avatar";
import type { UserSummary } from "@/lib/types";

function Face({ p, user, talking, me }: { p: VoicePeer; user?: UserSummary; talking: boolean; me: boolean }) {
  return (
    <span className={`vc-face ${talking ? "talking" : ""}`} title={`${user?.name ?? "Someone"}${me ? " (you)" : ""}${p.muted ? " · muted" : ""}`}>
      {user ? <Avatar user={user} size={30} /> : <span className="avatar" style={{ width: 30, height: 30 }} />}
      {p.muted ? (
        <span className="vc-muted">
          <MicOff size={10} />
        </span>
      ) : null}
    </span>
  );
}

/** While you're in a call: who's in it (talking ones glow), mute, deafen and hang up. */
export function VoiceDock() {
  const v = useVoice();
  const { conn } = useApp();
  const people = useMembers();
  if (v.room == null) return null;
  const peers = v.channels[v.room] ?? [];
  return (
    <div className="panel voice-dock" role="region" aria-label="Voice chat">
      <Link href={`/chat/${v.room}`} className="vc-room" title="Go to the room">
        <Radio size={16} className="vc-live" />
        <span className="ellipsis">{v.roomName}</span>
      </Link>
      <div className="vc-faces">
        {peers.map((p) => (
          <Face key={p.conn} p={p} user={people.get(p.userId)} talking={v.speaking.has(p.conn === conn ? "me" : p.conn)} me={p.conn === conn} />
        ))}
      </div>
      <div className="vc-btns">
        <button type="button" className={`icon-btn sm ${v.muted ? "on" : ""}`} onClick={v.toggleMute} aria-pressed={v.muted} aria-label={v.muted ? "Unmute" : "Mute"} title={v.muted ? "Unmute" : "Mute"}>
          {v.muted ? <MicOff size={17} /> : <Mic size={17} />}
        </button>
        <button type="button" className={`icon-btn sm ${v.deafened ? "on" : ""}`} onClick={v.toggleDeafen} aria-pressed={v.deafened} aria-label={v.deafened ? "Hear again" : "Deafen"} title={v.deafened ? "Hear again" : "Deafen (hear nothing)"}>
          {v.deafened ? <HeadphoneOff size={17} /> : <Headphones size={17} />}
        </button>
        <button type="button" className="icon-btn sm vc-leave" onClick={v.leave} aria-label="Leave the call" title="Leave the call">
          <PhoneOff size={17} />
        </button>
      </div>
    </div>
  );
}

/** A room's voice button: who's talking there, and join or leave. */
export function VoiceButton({ room, name, compact = false }: { room: number; name: string; compact?: boolean }) {
  const v = useVoice();
  const { site } = useApp();
  const people = useMembers();
  if (!site.features.voice) return null;
  const peers = v.channels[room] ?? [];
  const here = v.room === room;
  if (!v.supported)
    return (
      <span className="pill soft" title="Voice chat needs a microphone and the site opened over https://">
        <HeadphoneOff size={14} /> {compact ? "" : "Voice needs https"}
      </span>
    );
  return (
    <div className="row" style={{ gap: 6 }}>
      {peers.length && !compact ? (
        <span className="avatar-stack" title={peers.map((p) => people.get(p.userId)?.name ?? "Someone").join(", ")}>
          {peers.slice(0, 4).map((p) => {
            const u = people.get(p.userId);
            return u ? <Avatar key={p.conn} user={u} size={24} /> : null;
          })}
        </span>
      ) : null}
      <button
        type="button"
        className={`btn btn-sm ${here ? "btn-danger" : peers.length ? "btn-secondary" : ""} ${v.joining ? "loading" : ""}`}
        onClick={() => (here ? v.leave() : v.join(room, name))}
        title={here ? "Leave the voice chat" : "Join the voice chat"}
      >
        {here ? <PhoneOff size={15} /> : <Headphones size={15} />}
        {compact ? null : here ? "Leave voice" : peers.length ? `Join voice (${peers.length})` : "Voice"}
      </button>
      {v.error && !here ? <span className="small err-text">{v.error}</span> : null}
    </div>
  );
}
