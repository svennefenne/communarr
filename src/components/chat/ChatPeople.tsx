"use client";

import Link from "next/link";
import { Ellipsis, HeadphoneOff, Headphones, MicOff, PanelRightClose, PanelRightOpen, UserPlus } from "lucide-react";
import type { RoomInfo, RoomMember } from "@/lib/chatTypes";
import type { UserSummary } from "@/lib/types";
import { useApp, useT, useToast } from "@/components/app/AppProvider";
import { useMembers } from "@/components/app/useMembers";
import { useVoice, type VoicePeer } from "@/components/voice/VoiceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown } from "@/components/ui/ui";
import { menuProps } from "@/components/ui/ContextMenu";
import { membersAction, removeMemberAction, setMemberRoleAction } from "@/app/actions/chat";
import { useChatUi } from "./ChatShell";
import { usePersonMenu, useVoiceLook, voiceOf } from "./chatMenus";
import { Activity, LiveTag, useTalking } from "./VoicePresence";

/** A room admin's ⋯ on a member: make them an admin (or not), or take them out of the room. */
export function ManageMember({ roomId, m, onChanged }: { roomId: number; m: RoomMember; onChanged: (list: RoomMember[]) => void }) {
  const t = useT();
  const toast = useToast();
  const reload = async () => {
    const r = await membersAction(roomId);
    if (r.ok) onChanged(r.data);
  };
  return (
    <Dropdown label={t("Manage")} button={<Ellipsis size={16} />}>
      <button
        type="button"
        className="menu-item"
        data-close
        onClick={async () => {
          await setMemberRoleAction(roomId, m.user.id, m.role === "admin" ? "member" : "admin");
          await reload();
        }}
      >
        {m.role === "admin" ? t("Not admin any more") : t("Make admin")}
      </button>
      <button
        type="button"
        className="menu-item danger"
        data-close
        onClick={async () => {
          const r = await removeMemberAction(roomId, m.user.id);
          if (!r.ok) toast(r.error, { kind: "err" });
          await reload();
        }}
      >
        {t("Remove from the room")}
      </button>
    </Dropdown>
  );
}

/**
 * Who's in the room, beside it on a wide screen (as on Discord): those here now, then everyone else,
 * faded. An open room is everyone's, so it's everyone on the site; a private room or a group's, its
 * members; a direct message, the two of you. A right click (or ⋯) on someone opens their menu, a
 * room admin's keeping order too.
 *
 * Who's talking: a headphone by them (the voice shown under the rooms in the list), or (in the room)
 * those in this room's voice first, then those in each other room's, with what each one's doing.
 *
 * Folded (`rail`), it's only their faces, as the list of chats can be: those in a voice first, then
 * those here now, then the rest, faded.
 */
export function ChatPeople({
  info,
  members,
  canManage,
  onMembers,
  onInvite,
  onClose,
  onOpen,
  rail = false,
}: {
  info: RoomInfo;
  members: RoomMember[];
  canManage: boolean;
  onMembers: (list: RoomMember[]) => void;
  onInvite: () => void;
  onClose: () => void;
  onOpen: () => void;
  rail?: boolean;
}) {
  const t = useT();
  const { me, presence } = useApp();
  const everyone = useMembers();
  const v = useVoice();
  const look = useVoiceLook();
  const personMenu = usePersonMenu();
  const talking = useTalking();
  const { rooms } = useChatUi();
  const roles = new Map(members.map((m) => [m.user.id, m]));
  const all = info.kind === "room" && info.visibility === "open" && everyone.size ? [...everyone.values()] : members.map((m) => m.user);
  const here = (u: UserSummary) => u.id === me?.id || presence.has(u.id);
  const byName = (a: UserSummary, b: UserSummary) => a.name.localeCompare(b.name);
  const roomName = (id: number) => (id === v.room ? v.roomName : rooms.find((r) => r.id === id)?.name) ?? t("another room");
  const where = { room: info, canManage, onMembers };

  // (in the room: those in a voice get their own groups first, this room's then the others', in the order they came)
  const inRoomLook = look === "room";
  const voiceGroups: { room: number; people: { u: UserSummary; p: VoicePeer }[] }[] = [];
  if (inRoomLook || rail) {
    const ids = new Set(all.map((u) => u.id));
    const byId = new Map(all.map((u) => [u.id, u]));
    const order = [info.id, ...Object.keys(v.channels).map(Number).filter((r) => r !== info.id)];
    const seen = new Set<number>();
    for (const r of order) {
      const list: { u: UserSummary; p: VoicePeer }[] = [];
      for (const p of v.channels[r] ?? []) {
        if (!ids.has(p.userId) || seen.has(p.userId)) continue;
        seen.add(p.userId);
        list.push({ u: byId.get(p.userId)!, p });
      }
      if (list.length) voiceGroups.push({ room: r, people: list });
    }
  }
  const talkingSomewhere = new Set(voiceGroups.flatMap((g) => g.people.map((x) => x.u.id)));

  if (rail) {
    const inVoice = voiceGroups.flatMap((g) => g.people.map((x) => ({ ...x, room: g.room })));
    const onR = all.filter((u) => here(u) && !talkingSomewhere.has(u.id)).sort(byName);
    const offR = all.filter((u) => !here(u) && !talkingSomewhere.has(u.id)).sort(byName);
    const face = (u: UserSummary, faded: boolean, voice?: { p: VoicePeer; room: number }) => {
      const p = voice?.p;
      const what = p ? `${t("In the voice in {room}", { room: roomName(voice.room) })}${p.live ? ` · ${t("Sharing their screen")}` : p.deaf ? ` · ${t("Hears nothing")}` : p.held ? ` · ${t("Silenced by a room admin")}` : p.muted ? ` · ${t("Microphone off")}` : ""}` : u.statusText ? `${u.statusEmoji} ${u.statusText}`.trim() : "";
      const label = `${u.name}${u.id === me?.id ? ` (${t("you")})` : ""}${what ? ` · ${what}` : ""}`;
      return (
        <Link
          key={u.id}
          href={`/u/${encodeURIComponent(u.username)}`}
          className={`rail-item people-face ${faded ? "off" : ""} ${p && talking(p) ? "talking" : ""}`}
          title={label}
          aria-label={label}
          {...menuProps(() => personMenu(u, { ...where, member: roles.get(u.id) }), look)}
        >
          <Avatar user={u} size={38} presence={!p} />
          {p ? (
            <span className={`rail-talk ${p.live ? "live" : p.deaf || p.muted || p.held ? "muted" : ""}`}>{p.deaf ? <HeadphoneOff size={10} /> : p.muted || p.held ? <MicOff size={10} /> : <Headphones size={10} />}</span>
          ) : null}
        </Link>
      );
    };
    return (
      <aside className="panel chat-people rail" aria-label={t("Members")}>
        <div className="rail-head">
          <button type="button" className="icon-btn framed sm" onClick={onOpen} title={t("Show the names")} aria-label={t("Show the names")}>
            <PanelRightOpen size={16} />
          </button>
        </div>
        <div className="rail-list">
          {inVoice.map((x) => face(x.u, false, x))}
          {inVoice.length && onR.length ? <span className="rail-sep" /> : null}
          {onR.map((u) => face(u, false))}
          {offR.length && (onR.length || inVoice.length) ? <span className="rail-sep" /> : null}
          {offR.map((u) => face(u, true))}
        </div>
        {info.kind === "room" && info.myRole ? (
          <div className="rail-foot">
            <button type="button" className="icon-btn framed sm" onClick={onInvite} title={t("Invite people")} aria-label={t("Invite people")}>
              <UserPlus size={16} />
            </button>
          </div>
        ) : null}
      </aside>
    );
  }
  // (under the rooms: everyone in the plain groups, a headphone by those in a voice)
  const grouped = inRoomLook ? talkingSomewhere : new Set<number>();
  const on = all.filter((u) => here(u) && !grouped.has(u.id)).sort(byName);
  const off = all.filter((u) => !here(u) && !grouped.has(u.id)).sort(byName);

  const row = (u: UserSummary, faded: boolean, voice?: VoicePeer) => {
    const m = roles.get(u.id);
    const sub = m && m.role !== "member" ? t(m.role) : u.statusText || u.statusEmoji ? `${u.statusEmoji} ${u.statusText}`.trim() : "";
    const elsewhere = !inRoomLook ? voiceOf(v.channels, u.id) : null;
    const isTalking = !!voice && talking(voice);
    return (
      <div key={u.id} className={`people-row ${faded ? "off" : ""} ${isTalking ? "talking" : ""}`} {...menuProps(() => personMenu(u, { ...where, member: m }), look)}>
        <Link href={`/u/${encodeURIComponent(u.username)}`} className="people-link">
          <Avatar user={u} size={32} presence={!voice} />
          <span className="grow" style={{ minWidth: 0 }}>
            <span className="people-name ellipsis">
              {u.name}
              {u.id === me?.id ? <span className="muted"> ({t("you")})</span> : null}
            </span>
            {voice ? <Activity p={voice} talking={isTalking} name={u.name.split(" ")[0]} /> : sub ? <span className="tiny muted ellipsis">{sub}</span> : null}
          </span>
          {elsewhere ? (
            <span className="people-voice">
              <LiveTag p={elsewhere.peer} name={u.name.split(" ")[0]} />
              <span className="vp-ico teal" title={t("In the voice in {room}", { room: roomName(elsewhere.room) })}>
                <Headphones size={14} />
              </span>
            </span>
          ) : null}
        </Link>
        <button
          type="button"
          className="icon-btn sm people-more"
          aria-label={t("More")}
          title={t("More")}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: r.left, clientY: r.bottom + 4 }));
          }}
        >
          <Ellipsis size={16} />
        </button>
      </div>
    );
  };

  return (
    <aside className="panel chat-people" aria-label={t("Members")}>
      <div className="people-head">
        <h2 className="h3">{t("Members")}</h2>
        <span className="spacer" />
        <button type="button" className="icon-btn sm" onClick={onClose} title={t("Only the faces")} aria-label={t("Only the faces")}>
          <PanelRightClose size={18} />
        </button>
      </div>
      <div className="people-scroll">
        {(inRoomLook ? voiceGroups : []).map((g) => (
          <div key={g.room}>
            <div className="menu-label people-voice-head">
              <span className="grow ellipsis">{g.room === info.id ? t("In the voice here · {n}", { n: g.people.length }) : t("In the voice in {room} · {n}", { room: roomName(g.room), n: g.people.length })}</span>
              {g.room !== info.id && v.room !== g.room && v.supported ? (
                <button type="button" className="link-btn" onClick={() => void v.join(g.room, roomName(g.room))}>
                  {t("Join")}
                </button>
              ) : null}
            </div>
            {g.people.map(({ u, p }) => row(u, false, p))}
          </div>
        ))}
        {on.length || !voiceGroups.length ? <div className="menu-label">{t("Online · {n}", { n: on.length })}</div> : null}
        {on.map((u) => row(u, false))}
        {off.length ? <div className="menu-label">{t("Offline · {n}", { n: off.length })}</div> : null}
        {off.map((u) => row(u, true))}
      </div>
      {info.kind === "room" && info.myRole ? (
        <div className="people-foot">
          <button type="button" className="btn btn-sm btn-block" onClick={onInvite}>
            <UserPlus size={15} /> {t("Invite people")}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
