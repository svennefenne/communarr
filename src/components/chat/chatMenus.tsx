"use client";

import { useRouter } from "next/navigation";
import { Archive, AtSign, Bell, CheckCheck, Copy, DoorOpen, Headphones, HeadphoneOff, Link2, LogOut, MessageCircle, Mic, MicOff, MonitorPlay, PhoneOff, Settings, Shield, ShieldOff, Unplug, User, UserMinus, UserPlus, Users, VolumeX } from "lucide-react";
import type { RoomInfo, RoomMember } from "@/lib/chatTypes";
import type { UserSummary } from "@/lib/types";
import { useApp, useT, useToast } from "@/components/app/AppProvider";
import { useVoiceNow, type VoicePeer } from "@/components/voice/VoiceProvider";
import { useStreamNow } from "@/components/voice/StreamProvider";
import type { MenuEntry, MenuLook } from "@/components/ui/ContextMenu";
import { useChatUi } from "./ChatShell";
import { archiveRoomAction, dmAction, inviteToRoomAction, joinRoomAction, leaveRoomAction, markReadAction, membersAction, removeMemberAction, setMemberRoleAction, setNotifyAction } from "@/app/actions/chat";

/** How the chat shows voice (the member's choice, Settings → Display), and so how its menus look. */
export function useVoiceLook(): MenuLook {
  const { me } = useApp();
  return me?.theme.chatVoice === "room" ? "room" : "list";
}

/** Where someone is talking, if they are: the room, and their place in its channel. */
export function voiceOf(channels: Record<number, VoicePeer[]>, userId: number): { room: number; peer: VoicePeer } | null {
  for (const [room, peers] of Object.entries(channels)) {
    const peer = peers.find((p) => p.userId === userId);
    if (peer) return { room: Number(room), peer };
  }
  return null;
}

/** Ask the room you're in to put an @mention of someone in what you're writing. */
export const MENTION_EVENT = "chat-mention";

/** Where a person's menu is opened: in a room (its roles; removing people), or about a room's voice. */
export interface PersonWhere {
  room?: RoomInfo;
  /** you may manage the room's members */
  canManage?: boolean;
  member?: RoomMember;
  onMembers?: (list: RoomMember[]) => void;
}

const copy = (text: string) => void navigator.clipboard?.writeText(text).catch(() => {});

/** You may keep order in a room's voice: its owner or an admin of it, or the site's moderators. */
function canKeepOrder(rooms: RoomInfo[], room: number, me: { isAdmin: boolean; isMod: boolean }, here?: { id: number; can: boolean }) {
  if (me.isAdmin || me.isMod) return true;
  if (here?.id === room) return here.can;
  const r = rooms.find((x) => x.id === room);
  return !!r && r.kind !== "dm" && (r.myRole === "owner" || r.myRole === "admin");
}

/** A person's menu: their profile, a message, a mention; in a call, their volume and their stream; for room admins, keeping order. */
export function usePersonMenu() {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const { me } = useApp();
  const voiceNow = useVoiceNow();
  const streamNow = useStreamNow();
  const { rooms, confirm } = useChatUi();

  // (read when a menu opens: the call as it is then)
  return (u: UserSummary, where: PersonWhere = {}): MenuEntry[] => {
    const v = voiceNow.current;
    const s = streamNow.current;
    if (!me) return [];
    const at = v ? voiceOf(v.channels, u.id) : null;
    const roomName = (id: number) => (id === v?.room ? v.roomName : rooms.find((r) => r.id === id)?.name) ?? t("the room");
    const out: MenuEntry[] = [];

    if (u.id === me.id) {
      out.push({ label: t("View profile"), icon: User, run: () => router.push(`/u/${encodeURIComponent(u.username)}`) });
      if (v && v.room != null) {
        out.push("sep");
        out.push({ label: v.muted ? t("Unmute") : t("Mute"), icon: v.muted ? Mic : MicOff, run: v.toggleMute, disabled: v.held && v.muted });
        out.push({ label: v.deafened ? t("Hear again") : t("Deafen"), icon: v.deafened ? Headphones : HeadphoneOff, run: v.toggleDeafen });
        out.push({ label: t("Leave the voice chat"), icon: PhoneOff, danger: true, run: v.leave });
      } else if (v?.supported && where.room && where.room.kind !== "dm") {
        const r = where.room;
        out.push("sep", { label: t("Join the voice chat"), icon: Headphones, run: () => void v.join(r.id, r.name) });
      }
      out.push("sep", { label: t("Copy the username"), icon: Copy, run: () => copy(u.username) });
      return out;
    }

    out.push({ label: t("View profile"), icon: User, run: () => router.push(`/u/${encodeURIComponent(u.username)}`) });
    out.push({
      label: t("Send a message"),
      icon: MessageCircle,
      run: async () => {
        const r = await dmAction(u.id);
        if (r.ok) router.push(`/chat/${r.data}`);
        else toast(r.error, { kind: "err" });
      },
    });
    if (where.room && !where.room.archived) out.push({ label: t("Mention"), icon: AtSign, kbd: "@", run: () => window.dispatchEvent(new CustomEvent(MENTION_EVENT, { detail: { username: u.username, name: u.name } })) });

    if (at && v) {
      out.push("sep");
      const same = v.room === at.room;
      if (same) {
        if (at.peer.live && s) out.push({ label: t("Watch {name}'s screen", { name: u.name.split(" ")[0] }), icon: MonitorPlay, live: true, run: () => s.watch(at.peer.conn, u.id) });
        const mine = v.people[u.id];
        out.push({ key: "vol", node: <PersonVolume userId={u.id} name={u.name.split(" ")[0]} initial={Math.round((mine?.vol ?? 1) * 100)} /> });
        out.push({ label: t("Mute for me"), icon: VolumeX, checked: !!mine?.off, run: () => v.setPersonAudio(u.id, { off: !mine?.off }) });
      } else if (v.supported) {
        out.push({ label: t("Join the voice in {room}", { room: roomName(at.room) }), icon: Headphones, run: () => void v.join(at.room, roomName(at.room)) });
      }
    }

    const invitable = rooms.filter((r) => r.kind === "room" && r.myRole && !r.archived && r.id !== where.room?.id).slice(0, 12);
    if (invitable.length) {
      out.push("sep");
      out.push({
        label: t("Invite to"),
        icon: UserPlus,
        sub: invitable.map((r) => ({
          label: `${r.emoji ? `${r.emoji} ` : ""}${r.name}`,
          run: async () => {
            const res = await inviteToRoomAction(r.id, [u.id]);
            if (!res.ok) toast(res.error, { kind: "err" });
            else toast(res.data ? t("Invited {name} to {room}.", { name: u.name, room: r.name }) : t("{name} is in {room} already.", { name: u.name, room: r.name }));
          },
        })),
      });
    } else out.push("sep");
    out.push({ label: t("Copy the username"), icon: Copy, run: () => copy(u.username) });

    // keeping order: in the call, and in the room
    const mod: MenuEntry[] = [];
    if (at && canKeepOrder(rooms, at.room, me, where.room ? { id: where.room.id, can: !!where.canManage } : undefined)) {
      const held = at.peer.held;
      mod.push({ label: held ? t("Let them talk again") : t("Silence in the voice"), icon: held ? Mic : MicOff, mod: true, run: () => void v?.moderate(at.room, { hold: u.id, held: !held }) });
      mod.push({ label: t("Disconnect from the voice"), icon: Unplug, mod: true, run: () => void v?.moderate(at.room, { kick: u.id }) });
    }
    const r = where.room;
    const m = where.member;
    if (r && m && where.canManage && r.kind !== "dm" && m.role !== "owner") {
      const reload = async () => {
        const res = await membersAction(r.id);
        if (res.ok) where.onMembers?.(res.data);
      };
      mod.push({
        label: m.role === "admin" ? t("Not admin any more") : t("Make admin"),
        icon: m.role === "admin" ? ShieldOff : Shield,
        mod: true,
        run: async () => {
          await setMemberRoleAction(r.id, u.id, m.role === "admin" ? "member" : "admin");
          await reload();
        },
      });
      if (r.kind === "room")
        mod.push({
          label: t("Remove from the room"),
          icon: UserMinus,
          mod: true,
          danger: true,
          run: () =>
            confirm(t("Remove {name} from {room}?", { name: u.name, room: r.name }), t("Remove"), async () => {
              const res = await removeMemberAction(r.id, u.id);
              if (!res.ok) toast(res.error, { kind: "err" });
              await reload();
            }),
        });
    }
    if (mod.length) out.push("sep", { heading: t("Keep order") }, ...mod);
    return out;
  };
}

/** Someone's volume in the call, for you: kept as you slide it. */
function PersonVolume({ userId, name, initial }: { userId: number; name: string; initial: number }) {
  const t = useT();
  const voiceNow = useVoiceNow();
  return (
    <label className="ctx-volume">
      <span className="row" style={{ justifyContent: "space-between" }}>
        <span>{t("Volume for {name}", { name })}</span>
        <output className="mono">{initial} %</output>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        defaultValue={initial}
        style={{ "--p": `${initial}%` } as React.CSSProperties}
        onInput={(e) => {
          const el = e.currentTarget;
          el.style.setProperty("--p", `${el.value}%`);
          const out = el.parentElement?.querySelector("output");
          if (out) out.textContent = `${el.value} %`;
          voiceNow.current?.setPersonAudio(userId, { vol: Number(el.value) / 100 });
        }}
        aria-label={t("Volume for {name}", { name })}
      />
    </label>
  );
}

/** A room's menu: read, the voice, notifications, inviting, a link, leaving; for its admins, its settings and keeping order. */
export function useRoomMenu() {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const { me, counts, site } = useApp();
  const voiceNow = useVoiceNow();
  const streamNow = useStreamNow();
  const { confirm } = useChatUi();

  return (r: RoomInfo, o: { active?: boolean; onChanged?: () => void } = {}): MenuEntry[] => {
    const v = voiceNow.current;
    const s = streamNow.current;
    if (!me) return [];
    const out: MenuEntry[] = [];
    const member = !!r.myRole;
    const unread = counts.rooms[r.id] ?? 0;
    if (r.kind === "dm" && r.other) {
      const other = r.other;
      out.push({ label: t("View profile"), icon: User, run: () => router.push(`/u/${encodeURIComponent(other.username)}`) });
    }
    if (member) out.push({ label: t("Mark as read"), icon: CheckCheck, disabled: !unread, run: () => void markReadAction(r.id) });

    const peers = v?.channels[r.id] ?? [];
    if (v && site.features.voice && v.supported && r.kind !== "dm" && (member || r.visibility === "open")) {
      out.push("sep");
      if (v.room === r.id) out.push({ label: t("Leave the voice chat"), icon: PhoneOff, danger: true, run: v.leave });
      else out.push({ label: peers.length ? t("Join the voice chat ({n})", { n: peers.length }) : t("Join the voice chat"), icon: Headphones, run: () => void v.join(r.id, r.name) });
      const live = v.room === r.id ? peers.find((p) => p.live && p.userId !== me.id) : undefined;
      if (live && s) out.push({ label: t("Watch the shared screen"), icon: MonitorPlay, live: true, run: () => s.watch(live.conn, live.userId) });
    }

    out.push("sep");
    if (member)
      out.push({
        label: t("Notifications"),
        icon: Bell,
        sub: (
          [
            ["all", "Every message"],
            ["mentions", "Only @mentions"],
            ["none", "Nothing"],
          ] as const
        ).map(([mode, label]) => ({
          label: t(label),
          radio: r.notify === mode,
          run: async () => {
            const res = await setNotifyAction(r.id, mode);
            if (res.ok) o.onChanged?.();
          },
        })),
      });
    if (r.kind === "room" && member) out.push({ label: t("Invite people"), icon: UserPlus, run: () => router.push(`/chat/${r.id}?panel=invite`) });
    if (!member && r.kind === "room" && r.visibility === "open")
      out.push({
        label: t("Join the room"),
        icon: DoorOpen,
        run: async () => {
          const res = await joinRoomAction(r.id);
          if (res.ok) o.onChanged?.();
          else toast(res.error, { kind: "err" });
        },
      });
    out.push({ label: t("Copy the link"), icon: Link2, run: () => copy(`${location.origin}/chat/${r.id}`) });
    if (r.kind === "group" && r.groupSlug) out.push({ label: t("Go to the group"), icon: Users, run: () => router.push(`/groups/${r.groupSlug}`) });
    if (r.kind === "room" && member)
      out.push("sep", {
        label: t("Leave the room"),
        icon: LogOut,
        danger: true,
        run: () =>
          confirm(t("Leave {name}?", { name: r.name }), t("Leave"), async () => {
            await leaveRoomAction(r.id);
            o.onChanged?.();
            if (o.active) router.push("/chat");
          }),
      });

    const manage = r.kind !== "dm" && (me.isAdmin || r.myRole === "owner" || r.myRole === "admin");
    if (manage || (me.isMod && peers.length && r.kind !== "dm")) {
      const mod: MenuEntry[] = [];
      if (manage) mod.push({ label: t("Room settings"), icon: Settings, mod: true, run: () => router.push(`/chat/${r.id}?panel=settings`) });
      if (peers.length) mod.push({ label: t("Disconnect everyone from the voice"), icon: Unplug, mod: true, run: () => void v?.moderate(r.id, "kickAll") });
      if (manage)
        mod.push({
          label: r.archived ? t("Unarchive") : t("Archive"),
          icon: Archive,
          mod: true,
          run: async () => {
            const res = await archiveRoomAction(r.id, !r.archived);
            if (!res.ok) return toast(res.error, { kind: "err" });
            toast(res.data ? t("Archived: it's hidden from the lists.") : t("Back from the archive."));
            o.onChanged?.();
            if (o.active && res.data) router.push("/chat");
          },
        });
      out.push("sep", { heading: t("Manage the room") }, ...mod);
    }
    return out;
  };
}
