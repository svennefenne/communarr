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
  /** the site's sounds (Admin → Sounds): off for this member with the menu's switch; voice chat is never touched */
  sounds: boolean;
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
/** for each kind: in the bell, as a push notification on your devices, and by mail while you're away */
export type NotifyPrefs = Record<NotifyKind, { app: boolean; push: boolean; mail: boolean }> & { quietFrom: string; quietTo: string };

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
  /** an emoji, or one of the site's own as ":name:" */
  emoji: string;
  count: number;
  mine: boolean;
  users: string[];
}

/** One of the site's own emoji: written :name:, shown as its picture. */
export interface CustomEmoji {
  name: string;
  url: string;
  animated: boolean;
  /** who added it (null: they're gone) */
  by: number | null;
  byName: string | null;
  /** one of Google's animated Noto Emoji (CC BY 4.0: the site credits them) */
  noto: boolean;
}
