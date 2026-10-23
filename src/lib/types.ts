/** Types shared by the server and the browser. */

export type Role = "admin" | "moderator" | "member";
export type Presence = "auto" | "away" | "busy" | "invisible";
/** what others see */
export type LiveState = "online" | "away" | "busy" | "offline";

export interface UserSummary {
  id: number;
  username: string;
  name: string;
  avatar: string | null;
  accent: string;
  role: Role;
  statusText: string;
  statusEmoji: string;
}

export interface ThemePrefs {
  scheme: string;
  mode: "dark" | "light" | "system";
  /** a custom theme (themes table) instead of the scheme */
  custom: number | null;
  wipes: boolean;
  motion: boolean;
  /** text size: 90..125 (%) */
  textSize: number;
  /** compact lists */
  density: "comfy" | "compact";
}

export const NOTIFY_KINDS = {
  mention: "Someone mentions you",
  dm: "Direct messages",
  room: "New messages in your chat rooms",
  reply: "Comments on your posts, polls and events",
  forum: "Replies in forum threads you follow",
  invite: "Invitations (rooms, groups, events)",
  event: "Event reminders and changes",
  news: "News from the admins",
  poll: "Polls you voted in close",
  group: "Activity in your groups",
  reaction: "Reactions to your posts",
} as const;
export type NotifyKind = keyof typeof NOTIFY_KINDS;
/** for each kind: in the bell, and as a push notification on your devices */
export type NotifyPrefs = Record<NotifyKind, { app: boolean; push: boolean }> & { quietFrom: string; quietTo: string };

export interface NotificationItem {
  id: number;
  kind: string;
  title: string;
  body: string;
  url: string;
  read: boolean;
  createdAt: number;
  actor: UserSummary | null;
}

/** What a server action returns: ok (maybe with data), or an error to show. */
export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

export interface Reaction {
  emoji: string;
  count: number;
  mine: boolean;
  users: string[];
}
