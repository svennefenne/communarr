"use client";

import Link from "next/link";
import { Ellipsis, PanelRightClose, UserPlus } from "lucide-react";
import type { RoomInfo, RoomMember } from "@/lib/chatTypes";
import type { UserSummary } from "@/lib/types";
import { useApp, useT, useToast } from "@/components/app/AppProvider";
import { useMembers } from "@/components/app/useMembers";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown } from "@/components/ui/ui";
import { membersAction, removeMemberAction, setMemberRoleAction } from "@/app/actions/chat";

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
 * members; a direct message, the two of you. A room's admins manage its members from here too.
 */
export function ChatPeople({
  info,
  members,
  canManage,
  onMembers,
  onInvite,
  onClose,
}: {
  info: RoomInfo;
  members: RoomMember[];
  canManage: boolean;
  onMembers: (list: RoomMember[]) => void;
  onInvite: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const { me, presence } = useApp();
  const everyone = useMembers();
  const roles = new Map(members.map((m) => [m.user.id, m]));
  const all = info.kind === "room" && info.visibility === "open" && everyone.size ? [...everyone.values()] : members.map((m) => m.user);
  const here = (u: UserSummary) => u.id === me?.id || presence.has(u.id);
  const byName = (a: UserSummary, b: UserSummary) => a.name.localeCompare(b.name);
  const on = all.filter(here).sort(byName);
  const off = all.filter((u) => !here(u)).sort(byName);

  const row = (u: UserSummary, faded: boolean) => {
    const m = roles.get(u.id);
    const sub = m && m.role !== "member" ? t(m.role) : u.statusText || u.statusEmoji ? `${u.statusEmoji} ${u.statusText}`.trim() : "";
    return (
      <div key={u.id} className={`people-row ${faded ? "off" : ""}`}>
        <Link href={`/u/${encodeURIComponent(u.username)}`} className="people-link">
          <Avatar user={u} size={32} presence />
          <span className="grow" style={{ minWidth: 0 }}>
            <span className="people-name ellipsis">
              {u.name}
              {u.id === me?.id ? <span className="muted"> ({t("you")})</span> : null}
            </span>
            {sub ? <span className="tiny muted ellipsis">{sub}</span> : null}
          </span>
        </Link>
        {canManage && m && u.id !== me?.id && m.role !== "owner" && info.kind !== "dm" ? <ManageMember roomId={info.id} m={m} onChanged={onMembers} /> : null}
      </div>
    );
  };

  return (
    <aside className="panel chat-people" aria-label={t("Members")}>
      <div className="people-head">
        <h2 className="h3">{t("Members")}</h2>
        <span className="spacer" />
        <button type="button" className="icon-btn sm" onClick={onClose} title={t("Hide the members")} aria-label={t("Hide the members")}>
          <PanelRightClose size={18} />
        </button>
      </div>
      <div className="people-scroll">
        <div className="menu-label">{t("Online · {n}", { n: on.length })}</div>
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
