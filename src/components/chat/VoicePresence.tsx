"use client";

import { AudioLines, Eye, Headphones, HeadphoneOff, Mic, MicOff, MonitorUp, PhoneOff, Video, VolumeX } from "lucide-react";
import type { RoomInfo } from "@/lib/chatTypes";
import type { UserSummary } from "@/lib/types";
import { useApp, useT } from "@/components/app/AppProvider";
import { useMembers } from "@/components/app/useMembers";
import { useVoice, type VoicePeer } from "@/components/voice/VoiceProvider";
import { useStream } from "@/components/voice/StreamProvider";
import { useCallControlsHere } from "@/components/voice/dockSlot";
import { Avatar } from "@/components/ui/Avatar";
import { menuProps, type MenuLook } from "@/components/ui/ContextMenu";
import { usePersonMenu, type PersonWhere } from "./chatMenus";

/**
 * Who's in a room's voice, and what they're doing: talking (a green ring, only in the call you're in:
 * that's the one you hear), their microphone or their sound off, silenced by a room admin, their
 * webcam on, sharing their screen (LIVE: a press watches it). Shown under the room in the chat list
 * (VoiceList), or in the room itself (VoiceBar, and the members beside it), as each member prefers.
 */

/** talking now: someone in your call you hear (not one you've turned off for you) */
export function useTalking() {
  const v = useVoice();
  const { conn } = useApp();
  return (p: VoicePeer) => v.room != null && (v.channels[v.room] ?? []).some((x) => x.conn === p.conn) && v.speaking.has(p.conn === conn ? "me" : p.conn) && !v.people[p.userId]?.off;
}

/** the small signs by someone in a call */
export function VoiceIcons({ p, size = 15 }: { p: VoicePeer; size?: number }) {
  const t = useT();
  const v = useVoice();
  const off = !!v.people[p.userId]?.off;
  return (
    <>
      {off ? (
        <span className="vp-ico faint" title={t("Muted for you")}>
          <VolumeX size={size} />
        </span>
      ) : null}
      {p.deaf ? (
        <span className="vp-ico err" title={t("Hears nothing")}>
          <HeadphoneOff size={size} />
        </span>
      ) : p.held ? (
        <span className="vp-ico err" title={t("Silenced by a room admin")}>
          <MicOff size={size} />
        </span>
      ) : p.muted ? (
        <span className="vp-ico err" title={t("Microphone off")}>
          <MicOff size={size} />
        </span>
      ) : null}
      {p.camera ? (
        <span className="vp-ico teal" title={t("Camera on")}>
          <Video size={size} />
        </span>
      ) : null}
    </>
  );
}

/** a LIVE sign: in your call a press watches it (or stops watching); elsewhere it only says so */
export function LiveTag({ p, name }: { p: VoicePeer; name: string }) {
  const t = useT();
  const v = useVoice();
  const s = useStream();
  const { conn } = useApp();
  if (!p.live) return null;
  const here = v.room != null && (v.channels[v.room] ?? []).some((x) => x.conn === p.conn);
  if (!here || p.conn === conn)
    return (
      <span className="live-tag" title={p.conn === conn ? t("You're sharing your screen") : t("{name} is sharing their screen", { name })}>
        {t("LIVE")}
      </span>
    );
  const on = s.watching?.conn === p.conn;
  return (
    <button
      type="button"
      className={`live-tag ${on ? "on" : ""}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (on) s.unwatch();
        else s.watch(p.conn, p.userId);
      }}
      title={on ? t("Stop watching {name}", { name }) : t("Watch {name}'s screen", { name })}
      aria-pressed={on}
    >
      {t("LIVE")}
    </button>
  );
}

/** What someone in a call is doing, in a few words (the members beside the room). */
export function Activity({ p, talking, name }: { p: VoicePeer; talking: boolean; name: string }) {
  const t = useT();
  const v = useVoice();
  if (p.live)
    return (
      <span className="vp-act">
        <LiveTag p={p} name={name} /> {t("Sharing their screen")}
      </span>
    );
  if (talking)
    return (
      <span className="vp-act ok-text">
        <AudioLines size={13} /> {t("Talking")}
      </span>
    );
  if (p.deaf)
    return (
      <span className="vp-act err">
        <HeadphoneOff size={13} /> {t("Hears nothing")}
      </span>
    );
  if (p.held)
    return (
      <span className="vp-act err">
        <MicOff size={13} /> {t("Silenced by a room admin")}
      </span>
    );
  if (p.muted)
    return (
      <span className="vp-act err">
        <MicOff size={13} /> {t("Microphone off")}
      </span>
    );
  if (v.people[p.userId]?.off)
    return (
      <span className="vp-act">
        <VolumeX size={13} /> {t("Muted for you")}
      </span>
    );
  if (p.camera)
    return (
      <span className="vp-act teal">
        <Video size={13} /> {t("Camera on")}
      </span>
    );
  return (
    <span className="vp-act">
      <Headphones size={13} /> {t("In the voice")}
    </span>
  );
}

/** Under a room in the chat list: everyone in its voice (as on Discord). */
export function VoiceList({ r, look }: { r: RoomInfo; look: MenuLook }) {
  const t = useT();
  const v = useVoice();
  const { conn } = useApp();
  const people = useMembers();
  const talking = useTalking();
  const personMenu = usePersonMenu();
  const peers = v.channels[r.id] ?? [];
  return (
    <div className="voice-list" role="list" aria-label={t("In the voice")}>
      {peers.map((p) => {
        const u = people.get(p.userId);
        const name = u?.name ?? t("Someone");
        return (
          <div key={p.conn} role="listitem" tabIndex={0} className={`voice-person ${talking(p) ? "talking" : ""}`} {...menuProps(() => (u ? personMenu(u, { room: r }) : []), look)}>
            {u ? <Avatar user={u} size={24} /> : <span className="avatar" style={{ width: 24, height: 24 }} />}
            <span className="grow ellipsis">
              {name}
              {p.conn === conn ? <span className="muted"> {t("(you)")}</span> : null}
            </span>
            <span className="vp-icons">
              <VoiceIcons p={p} size={14} />
              <LiveTag p={p} name={name.split(" ")[0]} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * At the top of a room, while anyone is in its voice: the shared screen to watch, everyone in it (the
 * ones talking glow, if it's your call), and joining, or your microphone, sound and hanging up.
 */
export function VoiceBar({ info, look, where }: { info: RoomInfo; look: MenuLook; where: PersonWhere }) {
  const t = useT();
  const v = useVoice();
  const s = useStream();
  const { conn } = useApp();
  const people = useMembers();
  const talking = useTalking();
  const personMenu = usePersonMenu();
  const peers = v.channels[info.id] ?? [];
  const here = v.room === info.id;
  useCallControlsHere(here);
  if (!peers.length) return null;
  const live = peers.find((p) => p.live);
  const liveUser = live ? people.get(live.userId) : undefined;
  const firstName = (u?: UserSummary) => (u?.name ?? t("Someone")).split(" ")[0];
  const watchingIt = !!live && s.watching?.conn === live.conn;
  return (
    <div className="voice-bar" role="region" aria-label={t("Voice chat")}>
      {live ? (
        <button
          type="button"
          className={`vb-stream ${watchingIt ? "on" : ""}`}
          disabled={!here || live.conn === conn}
          onClick={() => (watchingIt ? s.unwatch() : s.watch(live.conn, live.userId))}
          title={live.conn === conn ? t("You're sharing your screen") : !here ? t("Join the voice to watch") : watchingIt ? t("Stop watching {name}", { name: firstName(liveUser) }) : t("Watch {name}'s screen", { name: firstName(liveUser) })}
          {...(liveUser ? menuProps(() => personMenu(liveUser, where), look) : {})}
        >
          <span className="live-tag">{t("LIVE")}</span>
          <MonitorUp size={22} />
          <span className="vb-cap ellipsis">{live.conn === conn ? t("Your screen") : t("{name} is sharing", { name: firstName(liveUser) })}</span>
          {here && live.conn !== conn ? <span className="vb-watch">{watchingIt ? t("Watching") : <><Eye size={13} /> {t("Watch")}</>}</span> : null}
        </button>
      ) : null}
      <div className="vb-people" role="list">
        {peers.map((p) => {
          const u = people.get(p.userId);
          return (
            <div key={p.conn} role="listitem" tabIndex={0} className={`vb-person ${talking(p) ? "talking" : ""}`} title={u?.name} {...menuProps(() => (u ? personMenu(u, where) : []), look)}>
              <span className="vb-face">
                {u ? <Avatar user={u} size={40} /> : <span className="avatar" style={{ width: 40, height: 40 }} />}
                {p.deaf || p.held || p.muted ? (
                  <span className="vb-badge err">{p.deaf ? <HeadphoneOff size={10} /> : <MicOff size={10} />}</span>
                ) : p.camera ? (
                  <span className="vb-badge teal">
                    <Video size={10} />
                  </span>
                ) : null}
                {p.live ? <span className="live-tag vb-live">{t("LIVE")}</span> : null}
              </span>
              <span className="vb-name ellipsis">{p.conn === conn ? t("You") : firstName(u)}</span>
            </div>
          );
        })}
      </div>
      <div className="vb-ctrl">
        {here ? (
          <>
            <button type="button" className={`icon-btn framed ${v.muted ? "danger-on" : ""}`} onClick={v.toggleMute} aria-pressed={v.muted} aria-label={v.muted ? t("Unmute") : t("Mute")} title={v.held ? t("A room admin has silenced you in the voice chat.") : v.muted ? t("Unmute") : t("Mute")}>
              {v.muted ? <MicOff size={17} /> : <Mic size={17} />}
            </button>
            <button type="button" className={`icon-btn framed ${v.deafened ? "danger-on" : ""}`} onClick={v.toggleDeafen} aria-pressed={v.deafened} aria-label={v.deafened ? t("Hear again") : t("Deafen")} title={v.deafened ? t("Hear again") : t("Deafen (hear nothing)")}>
              {v.deafened ? <HeadphoneOff size={17} /> : <Headphones size={17} />}
            </button>
            <button type="button" className="icon-btn framed vc-leave" onClick={v.leave} aria-label={t("Leave the call")} title={t("Leave the call")}>
              <PhoneOff size={17} />
            </button>
          </>
        ) : v.supported ? (
          <>
            <span className="vb-sum">
              <b>{t.n(peers.length, "{n} in the voice", "{n} in the voice")}</b>
            </span>
            <button type="button" className={`btn btn-sm btn-go ${v.joining ? "loading" : ""}`} onClick={() => void v.join(info.id, info.name)}>
              <Headphones size={15} /> {t("Join")}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
