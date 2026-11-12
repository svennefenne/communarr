"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, Headphones, HeadphoneOff, Mic, MicOff, MonitorOff, MonitorUp, PhoneOff, Radio, Settings2, Video, VideoOff } from "lucide-react";
import { useVoice, type VoicePeer } from "./VoiceProvider";
import { useApp, useT } from "@/components/app/AppProvider";
import { useMembers } from "@/components/app/useMembers";
import { Avatar } from "@/components/ui/Avatar";
import type { UserSummary } from "@/lib/types";
import { Modal } from "@/components/ui/ui";
import { keyName } from "./pipeline";
import { VoiceSettings } from "./VoiceSettings";
import { useStream } from "./StreamProvider";
import { GoLiveDialog } from "./StreamPlayer";

/**
 * Someone in the call (glowing while they talk); sharing their screen: LIVE, and a press watches it;
 * their webcam on: a camera, and a press shows the video.
 */
function Face({ p, user, talking, me }: { p: VoicePeer; user?: UserSummary; talking: boolean; me: boolean }) {
  const t = useT();
  const s = useStream();
  const name = `${user?.name ?? t("Someone")}${me ? ` ${t("(you)")}` : ""}`;
  const face = (
    <>
      {user ? <Avatar user={user} size={30} /> : <span className="avatar" style={{ width: 30, height: 30 }} />}
      {p.muted ? (
        <span className="vc-muted">
          <MicOff size={10} />
        </span>
      ) : null}
      {p.camera ? (
        <span className="vc-cam">
          <Video size={9} />
        </span>
      ) : null}
      {p.live ? <span className="live-tag vc-live-tag">{t("LIVE")}</span> : null}
    </>
  );
  if (!p.live && p.camera)
    return (
      <button type="button" className={`vc-face live ${talking ? "talking" : ""}`} onClick={() => s.setCamsHidden(false)} aria-label={t("Show the video")} title={`${name} · ${t("Show the video")}`}>
        {face}
      </button>
    );
  if (!p.live)
    return (
      <span className={`vc-face ${talking ? "talking" : ""}`} title={`${name}${p.muted ? ` · ${t("muted")}` : ""}`}>
        {face}
      </span>
    );
  const on = s.watching?.conn === p.conn;
  const label = on ? t("Stop watching {name}", { name }) : me ? t("See your stream") : t("Watch {name}'s screen", { name });
  return (
    <button type="button" className={`vc-face live ${talking ? "talking" : ""} ${on ? "watching" : ""}`} onClick={() => (on ? s.unwatch() : s.watch(p.conn, p.userId))} aria-pressed={on} aria-label={label} title={label}>
      {face}
    </button>
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
  const s = useStream();
  const t = useT();
  const { conn } = useApp();
  const people = useMembers();
  const [settings, setSettings] = useState(false);
  const [going, setGoing] = useState(false);
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
        {s.live ? (
          <span className="vc-viewers" title={s.viewers.length ? s.viewers.map((c) => people.get(peers.find((p) => p.conn === c)?.userId ?? 0)?.name ?? t("Someone")).join(", ") : t("No one is watching yet")}>
            <Eye size={14} /> {s.viewers.length}
          </span>
        ) : null}
        {/* push to talk: which key, lit while it's held */}
        {v.prefs.mode === "ptt" && !v.muted ? (
          <span className={`vc-ptt ${v.talkKey ? "on" : ""}`} title={t("Push to talk")}>
            {v.talkKey ? t("Talking") : t("Hold {key}", { key: keyName(v.prefs.key) })}
          </span>
        ) : null}
        {s.live ? (
          <button type="button" className="icon-btn sm on" onClick={s.stopLive} aria-label={t("Stop sharing")} title={t("Stop sharing")}>
            <MonitorOff size={17} />
          </button>
        ) : s.canShare ? (
          <button type="button" className="icon-btn sm" onClick={() => setGoing(true)} aria-label={t("Share your screen")} title={t("Share your screen")}>
            <MonitorUp size={17} />
          </button>
        ) : null}
        <button type="button" className="icon-btn sm" onClick={() => setSettings(true)} aria-label={t("Voice settings")} title={t("Voice settings")}>
          <Settings2 size={17} />
        </button>
        <button type="button" className={`icon-btn sm ${v.muted ? "on" : ""}`} onClick={v.toggleMute} aria-pressed={v.muted} aria-label={v.muted ? t("Unmute") : t("Mute")} title={v.muted ? t("Unmute") : t("Mute")}>
          {v.muted ? <MicOff size={17} /> : <Mic size={17} />}
        </button>
        {v.camerasAllowed ? (
          <button type="button" className={`icon-btn sm ${v.cameraBusy ? "loading" : ""}`} onClick={() => void v.toggleCamera()} disabled={v.cameraBusy} aria-pressed={!!v.camera} aria-label={v.camera ? t("Turn your camera off") : t("Turn your camera on")} title={v.camera ? t("Turn your camera off") : t("Turn your camera on")}>
            {v.camera ? <Video size={17} /> : <VideoOff size={17} />}
          </button>
        ) : null}
        <button type="button" className={`icon-btn sm ${v.deafened ? "on" : ""}`} onClick={v.toggleDeafen} aria-pressed={v.deafened} aria-label={v.deafened ? t("Hear again") : t("Deafen")} title={v.deafened ? t("Hear again") : t("Deafen (hear nothing)")}>
          {v.deafened ? <HeadphoneOff size={17} /> : <Headphones size={17} />}
        </button>
        <button type="button" className="icon-btn sm vc-leave" onClick={v.leave} aria-label={t("Leave the call")} title={t("Leave the call")}>
          <PhoneOff size={17} />
        </button>
      </div>
      {going ? <GoLiveDialog onClose={() => setGoing(false)} /> : null}
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

/**
 * A room's voice button: who's talking there, and join or leave. Beside it, sharing your screen (a
 * computer, and the site lets you) and your webcam: they join the voice first if you're not in it.
 */
export function VoiceButton({ room, name, compact = false }: { room: number; name: string; compact?: boolean }) {
  const v = useVoice();
  const s = useStream();
  const t = useT();
  const { site } = useApp();
  const people = useMembers();
  const [going, setGoing] = useState(false);
  if (!site.features.voice) return null;
  const peers = v.channels[room] ?? [];
  const here = v.room === room;
  const live = peers.some((p) => p.live);
  const sharing = here && s.live;
  const share = async () => {
    if (sharing) return s.stopLive();
    if (!here && !(await v.join(room, name))) return;
    setGoing(true);
  };
  const filming = here && !!v.camera;
  const film = async () => {
    if (!here && !(await v.join(room, name))) return;
    await v.toggleCamera();
  };
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
      {live ? (
        <span className="live-tag" title={t("Someone is sharing their screen")}>
          {t("LIVE")}
        </span>
      ) : null}
      {s.canGoLive ? (
        <button type="button" className={`btn btn-sm ${sharing ? "btn-danger" : ""}`} onClick={() => void share()} disabled={v.joining} title={sharing ? t("Stop sharing") : t("Share your screen")} aria-label={sharing ? t("Stop sharing") : t("Share your screen")}>
          {sharing ? <MonitorOff size={15} /> : <MonitorUp size={15} />}
          {compact ? null : sharing ? t("Stop sharing") : t("Share your screen")}
        </button>
      ) : null}
      {going ? <GoLiveDialog onClose={() => setGoing(false)} /> : null}
      {v.camerasAllowed ? (
        <button type="button" className={`btn btn-sm ${filming ? "btn-danger" : ""}`} onClick={() => void film()} disabled={v.joining || v.cameraBusy} title={filming ? t("Turn your camera off") : t("Turn your camera on")} aria-label={filming ? t("Turn your camera off") : t("Turn your camera on")}>
          {filming ? <VideoOff size={15} /> : <Video size={15} />}
          {compact ? null : filming ? t("Camera off") : t("Camera")}
        </button>
      ) : null}
      <button
        type="button"
        className={`btn btn-sm ${here ? "btn-danger" : peers.length ? "btn-secondary" : ""} ${v.joining ? "loading" : ""}`}
        onClick={() => (here ? v.leave() : void v.join(room, name))}
        title={here ? t("Leave the voice chat") : t("Join the voice chat")}
      >
        {here ? <PhoneOff size={15} /> : <Headphones size={15} />}
        {compact ? null : here ? t("Leave voice") : peers.length ? t("Join voice ({n})", { n: peers.length }) : t("Voice")}
      </button>
      {v.error && !here ? <span className="small err-text">{v.error}</span> : null}
    </div>
  );
}
