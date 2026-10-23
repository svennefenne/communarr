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
