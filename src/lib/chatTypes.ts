import type { Reaction, UserSummary } from "./types";

export type RoomKind = "room" | "dm" | "group";
export type RoomVisibility = "open" | "private";
export type MemberRole = "owner" | "admin" | "member";

export interface RoomInfo {
  id: number;
  name: string;
  topic: string;
  emoji: string;
  kind: RoomKind;
  visibility: RoomVisibility;
  groupId: number | null;
  groupSlug: string | null;
  memberCount: number;
  lastMessageAt: number | null;
  lastMessage: { author: string; text: string } | null;
  /** your part in it (null: not a member) */
  myRole: MemberRole | null;
  notify: "all" | "mentions" | "none";
  unread: number;
  /** a DM: the other person */
  other: UserSummary | null;
  invited: boolean;
  archived: boolean;
  /** where an admin put it in the chat list (null: not placed) */
  position: number | null;
}

export interface ChatMessage {
  id: number;
  room: number;
  author: UserSummary | null;
  kind: "text" | "system";
  html: string;
  createdAt: number;
  editedAt: number | null;
  deleted: boolean;
  pinned: boolean;
  /** what's replied to (author "": gone; the browser says "Someone" and "(deleted)") */
  replyTo: { id: number; author: string; text: string; deleted?: boolean } | null;
  reactions: Reaction[];
}

export interface RoomMember {
  user: UserSummary;
  role: MemberRole;
}

/**
 * The order of rooms in the chat list: the ones an admin placed first, in their order, then the rest
 * by their latest message (direct messages are always by their latest message).
 */
export function byPlace(a: Pick<RoomInfo, "position" | "lastMessageAt">, b: Pick<RoomInfo, "position" | "lastMessageAt">): number {
  if (a.position != null && b.position != null) return a.position - b.position;
  if (a.position != null) return -1;
  if (b.position != null) return 1;
  return (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0);
}

/** How the chat is laid out on a computer: the list of chats as only their icons, and the members beside the room. */
export interface ChatUi {
  rail: boolean;
  people: boolean;
}
export const CHAT_UI_COOKIE = "hd_chat";
/** "10": the list as icons (1) or whole (0), then the members shown (1) or hidden (0) */
export const readChatUi = (raw: string | undefined): ChatUi => ({ rail: raw?.[0] === "1", people: raw?.[1] !== "0" });
