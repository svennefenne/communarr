import { Bookmark, CalendarDays, House, MessageCircle, MessagesSquare, Newspaper, Palette, Settings, ShieldCheck, UserRound, Users, UsersRound, Vote, type LucideIcon } from "lucide-react";
import type { Features } from "@/lib/bootTypes";

export interface Section {
  href: string;
  label: string;
  icon: LucideIcon;
  feature?: keyof Features;
  exact?: boolean;
}

/** The sections in the header (and the phone's bottom bar: the first four that are on, then More). */
export const SECTIONS: Section[] = [
  { href: "/", label: "Home", icon: House, exact: true },
  { href: "/forum", label: "Forum", icon: MessagesSquare, feature: "forum" },
  { href: "/chat", label: "Chat", icon: MessageCircle, feature: "chat" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, feature: "calendar" },
  { href: "/polls", label: "Polls", icon: Vote, feature: "polls" },
  { href: "/groups", label: "Groups", icon: UsersRound, feature: "groups" },
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
