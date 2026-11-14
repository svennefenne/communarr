import { Bookmark, CalendarDays, House, ListChecks, MessageCircle, MessagesSquare, Newspaper, Palette, Settings, ShieldCheck, UserRound, Users, UsersRound, Vote, type LucideIcon } from "lucide-react";
import type { Features } from "@/lib/bootTypes";

export interface Section {
  href: string;
  label: string;
  icon: LucideIcon;
  feature?: keyof Features;
  exact?: boolean;
  /** in the header, its icon instead of its name (the name still said to screen readers, and on hover) */
  iconOnly?: boolean;
}

/** The sections in the header, in its order (the phone's bottom bar has its own: barSections). */
export const SECTIONS: Section[] = [
  { href: "/", label: "Home", icon: House, exact: true, iconOnly: true },
  { href: "/groups", label: "Groups", icon: UsersRound, feature: "groups" },
  { href: "/forum", label: "Forum", icon: MessagesSquare, feature: "forum" },
  { href: "/chat", label: "Chat", icon: MessageCircle, feature: "chat" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, feature: "calendar" },
  { href: "/polls", label: "Polls", icon: Vote, feature: "polls" },
  { href: "/lists", label: "Lists", icon: ListChecks, feature: "lists" },
];

/** More places, in the drawer. */
export const MORE: Section[] = [
  { href: "/news", label: "News", icon: Newspaper, feature: "news" },
  { href: "/members", label: "Members", icon: Users },
  { href: "/me", label: "My stuff", icon: UserRound },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/settings/theme", label: "Theme", icon: Palette },
  { href: "/settings", label: "Settings", icon: Settings, exact: true },
];

export const ADMIN: Section = { href: "/admin", label: "Admin", icon: ShieldCheck };

export function visibleSections(features: Features) {
  return SECTIONS.filter((s) => !s.feature || features[s.feature]);
}

/** The phone's bottom bar: the first four that are on, groups after the rest (they're under More), then More. */
export function barSections(features: Features) {
  const on = visibleSections(features);
  return [...on.filter((s) => s.href !== "/groups"), ...on.filter((s) => s.href === "/groups")].slice(0, 4);
}

/** Every place in the menus that's switched on (the editor's Link offers them). */
export function allSections(features: Features) {
  return [...SECTIONS, ...MORE].filter((s) => !s.feature || features[s.feature]);
}

export function isActive(s: Section, pathname: string) {
  if (s.exact) return pathname === s.href;
  return pathname === s.href || pathname.startsWith(s.href + "/");
}

/** Pages that are only their window (no header, frame or bars). */
export function isBare(pathname: string) {
  return pathname === "/login" || pathname === "/setup" || pathname === "/signup" || pathname === "/forgot" || pathname.startsWith("/invite/") || pathname.startsWith("/reset/") || pathname.startsWith("/mail/");
}

/** Where each section's live dot comes from. */
export const CHAT_HREF = "/chat";
