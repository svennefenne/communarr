"use server";

import { act } from "@/lib/act";
import { UserError } from "@/lib/errors";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import {
  archiveRoom,
  arrangeRooms,
  canSee,
  createRoom,
  declineInvite,
  deleteMessage,
  deleteRoom,
  dmRoom,
  editMessage,
  inviteToRoom,
  joinRoom,
  leaveRoom,
  markRead,
  members,
  messages,
  pinMessage,
  pinned,
  reactToMessage,
  removeMember,
  room,
  roomInfo,
  roomsFor,
  sendMessage,
  setMemberRole,
  setNotify,
  typing,
  updateRoom,
} from "@/lib/chat";
import type { MemberRole, RoomVisibility } from "@/lib/chatTypes";

export async function roomsAction() {
  return act((u) => roomsFor(u));
}

export async function roomInfoAction(id: number) {
  return act((u) => {
    const r = room(id);
    // members (or anyone, for an open room), and people invited in
    if (!r || !(canSee(u, r) || db().prepare("select 1 from room_invites where room_id = ? and user_id = ?").get(id, u.id))) throw new UserError("That room is gone.");
    return roomInfo(u, r);
  });
}

export async function messagesAction(roomId: number, o: { before?: number; around?: number } = {}) {
  return act((u) => messages(u, roomId, o));
}

/** Chat switched off under Admin → Features: nothing new can be written or started. */
function chatOn() {
  if (!getSettings().features.chat) throw new UserError("Chat is switched off.");
}

export async function sendAction(roomId: number, html: string, replyTo?: number | null) {
  return act((u) => {
    chatOn();
    return sendMessage(u, roomId, html, replyTo);
  });
}

export async function editMessageAction(id: number, html: string) {
  return act((u) => editMessage(u, id, html));
}

export async function deleteMessageAction(id: number) {
  return act((u) => {
    deleteMessage(u, id);
    return true;
  });
}

export async function reactMessageAction(id: number, emoji: string) {
  return act((u) => reactToMessage(u, id, emoji));
}

export async function pinMessageAction(id: number, on: boolean) {
  return act((u) => {
    pinMessage(u, id, on);
    return on;
  });
}

export async function pinnedAction(roomId: number) {
  return act((u) => pinned(u, roomId));
}

export async function markReadAction(roomId: number, lastId?: number) {
  return act((u) => {
    markRead(u, roomId, lastId);
    return true;
  });
}

export async function typingAction(roomId: number) {
  return act((u) => {
    typing(u, roomId);
    return true;
  });
}

export async function createRoomAction(input: { name: string; topic?: string; emoji?: string; visibility: RoomVisibility; invite?: number[] }) {
  return act((u) => {
    chatOn();
    const s = getSettings();
    if (s.canCreate.rooms === "mods" && !u.isMod) throw new UserError("Only moderators can make rooms.");
    return createRoom(u, input);
  });
}

export async function updateRoomAction(id: number, input: { name?: string; topic?: string; emoji?: string; visibility?: RoomVisibility }) {
  return act((u) => {
    updateRoom(u, id, input);
    return true;
  });
}

export async function joinRoomAction(id: number) {
  return act((u) => {
    chatOn();
    joinRoom(u, id);
    return true;
  });
}

export async function leaveRoomAction(id: number) {
  return act((u) => {
    leaveRoom(u, id);
    return true;
  });
}

export async function declineInviteAction(id: number) {
  return act((u) => {
    declineInvite(u, id);
    return true;
  });
}

export async function inviteToRoomAction(id: number, userIds: number[]) {
  return act((u) => {
    chatOn();
    return inviteToRoom(u, id, userIds);
  });
}

export async function removeMemberAction(id: number, userId: number) {
  return act((u) => {
    removeMember(u, id, userId);
    return true;
  });
}

export async function setMemberRoleAction(id: number, userId: number, role: MemberRole) {
  return act((u) => {
    setMemberRole(u, id, userId, role);
    return true;
  });
}

export async function membersAction(id: number) {
  return act((u) => {
    const r = room(id);
    if (!r || !canSee(u, r)) throw new UserError("That room is gone.");
    return members(id);
  });
}

export async function setNotifyAction(id: number, mode: "all" | "mentions" | "none") {
  return act((u) => {
    setNotify(u, id, mode);
    return mode;
  });
}

export async function dmAction(userId: number) {
  return act((u) => {
    chatOn();
    return dmRoom(u, userId);
  });
}

/** An admin's order for the rooms in everyone's chat list. */
export async function arrangeRoomsAction(ids: number[]) {
  return act((u) => {
    arrangeRooms(u, ids);
    return true;
  });
}

export async function archiveRoomAction(id: number, archived: boolean) {
  return act((u) => {
    archiveRoom(u, id, archived);
    return archived;
  });
}

export async function deleteRoomAction(id: number) {
  return act((u) => {
    deleteRoom(u, id);
    return true;
  });
}
