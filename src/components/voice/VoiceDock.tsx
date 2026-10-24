"use client";

import Link from "next/link";
import { useState } from "react";
import { Headphones, HeadphoneOff, Mic, MicOff, PhoneOff, Radio, Settings2 } from "lucide-react";
import { useVoice, type VoicePeer } from "./VoiceProvider";
import { useApp, useT } from "@/components/app/AppProvider";
import { useMembers } from "@/components/app/useMembers";
import { Avatar } from "@/components/ui/Avatar";
import type { UserSummary } from "@/lib/types";
import { Modal } from "@/components/ui/ui";
import { keyName } from "./pipeline";
import { VoiceSettings } from "./VoiceSettings";

function Face({ p, user, talking, me }: { p: VoicePeer; user?: UserSummary; talking: boolean; me: boolean }) {
  const t = useT();
  return (
    <span className={`vc-face ${talking ? "talking" : ""}`} title={`${user?.name ?? t("Someone")}${me ? ` ${t("(you)")}` : ""}${p.muted ? ` · ${t("muted")}` : ""}`}>
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
  // (the member list is only fetched while there's a call)
  return v.room == null ? null : <Dock />;
}

function Dock() {
  const v = useVoice();
  const t = useT();
  const { conn } = useApp();
  const people = useMembers();
  const [settings, setSettings] = useState(false);
  if (v.room == null) return null;
  const peers = v.channels[v.room] ?? [];
  return (
    <div className="panel voice-dock" role="region" aria-label={t("Voice chat")}>
      <Link href={`/chat/${v.room}`} className="vc-room" title={t("Go to the room")}>
        <Radio size={16} className="vc-live" />
        <span className="ellipsis">{v.roomName}</span>
      </Link>
      <div className="vc-faces">
        {peers.map((p) => (
          <Face key={p.conn} p={p} user={people.get(p.userId)} talking={v.speaking.has(p.conn === conn ? "me" : p.conn)} me={p.conn === conn} />
        ))}
      </div>
      <div className="vc-btns">
        {/* push to talk: which key, lit while it's held */}
        {v.prefs.mode === "ptt" && !v.muted ? (
          <span className={`vc-ptt ${v.talkKey ? "on" : ""}`} title={t("Push to talk")}>
            {v.talkKey ? t("Talking") : t("Hold {key}", { key: keyName(v.prefs.key) })}
          </span>
        ) : null}
        <button type="button" className="icon-btn sm" onClick={() => setSettings(true)} aria-label={t("Voice settings")} title={t("Voice settings")}>
          <Settings2 size={17} />
        </button>
        <button type="button" className={`icon-btn sm ${v.muted ? "on" : ""}`} onClick={v.toggleMute} aria-pressed={v.muted} aria-label={v.muted ? t("Unmute") : t("Mute")} title={v.muted ? t("Unmute") : t("Mute")}>
          {v.muted ? <MicOff size={17} /> : <Mic size={17} />}
        </button>
        <button type="button" className={`icon-btn sm ${v.deafened ? "on" : ""}`} onClick={v.toggleDeafen} aria-pressed={v.deafened} aria-label={v.deafened ? t("Hear again") : t("Deafen")} title={v.deafened ? t("Hear again") : t("Deafen (hear nothing)")}>
          {v.deafened ? <HeadphoneOff size={17} /> : <Headphones size={17} />}
        </button>
        <button type="button" className="icon-btn sm vc-leave" onClick={v.leave} aria-label={t("Leave the call")} title={t("Leave the call")}>
          <PhoneOff size={17} />
        </button>
      </div>
      {settings ? (
        <Modal onClose={() => setSettings(false)} label={t("Voice settings")}>
          <h2 className="h2" style={{ marginTop: 0, marginBottom: 14 }}>
            {t("Voice settings")}
          </h2>
          <VoiceSettings />
        </Modal>
      ) : null}
    </div>
  );
}

/** A room's voice button: who's talking there, and join or leave. */
export function VoiceButton({ room, name, compact = false }: { room: number; name: string; compact?: boolean }) {
  const v = useVoice();
  const t = useT();
  const { site } = useApp();
  const people = useMembers();
  if (!site.features.voice) return null;
  const peers = v.channels[room] ?? [];
  const here = v.room === room;
  if (!v.supported)
    return (
      <span className="pill soft" title={t("Voice chat needs a microphone and the site opened over https://")}>
        <HeadphoneOff size={14} /> {compact ? "" : t("Voice needs https")}
      </span>
    );
  return (
    <div className="row" style={{ gap: 6 }}>
      {peers.length && !compact ? (
        <span className="avatar-stack" title={peers.map((p) => people.get(p.userId)?.name ?? t("Someone")).join(", ")}>
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
        title={here ? t("Leave the voice chat") : t("Join the voice chat")}
      >
        {here ? <PhoneOff size={15} /> : <Headphones size={15} />}
        {compact ? null : here ? t("Leave voice") : peers.length ? t("Join voice ({n})", { n: peers.length }) : t("Voice")}
      </button>
      {v.error && !here ? <span className="small err-text">{v.error}</span> : null}
    </div>
  );
}
