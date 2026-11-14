import type { Features } from "./bootTypes";
import type { FeedFilter } from "./contentTypes";

/**
 * The front page (Admin → Front page): which parts are in its side columns, on which side, in what
 * order, and how the calendar shows; and what its feed shows. One layout for everyone. Kept in the setting "home"; read
 * it through homeLayout, which fills in a part added later (at its default place) and drops anything odd.
 */

export const HOME_PANELS = ["filters", "calendar", "online", "chat", "forum", "polls", "lists", "groups", "news"] as const;
export type HomePanel = (typeof HOME_PANELS)[number];
export type HomeSide = "left" | "right";
/** where a part is: a side column, or (the feed's filters only) above the feed in the middle */
export type HomePlace = HomeSide | "middle";

export interface HomePanelSlot {
  id: HomePanel;
  side: HomePlace;
  on: boolean;
}

export interface HomeLayout {
  /** in order: each side's parts top to bottom */
  panels: HomePanelSlot[];
  /** the calendar as this month (its days, and its events under them) or as what's coming up */
  calendar: "month" | "upcoming";
  /** what the feed in the middle shows (at least one) */
  feed: FeedKind[];
  /** the latest news (pinned, or from the last week) in a banner above the feed */
  hero: boolean;
  /** a group's page: the parts of the side column beside its tabs, and its feed's filters */
  group: PageSlot<GroupPart>[];
  /** a profile: the same */
  profile: PageSlot<ProfilePart>[];
}

/**
 * A group's page and a profile (Admin → Front page too): the parts of the side column beside them, in
 * order, each on or off; and the feed's filters, above the feed (the middle) or among those parts.
 */
export const GROUP_PARTS = ["filters", "upcoming", "members"] as const;
export const PROFILE_PARTS = ["filters", "about", "groups"] as const;
export type GroupPart = (typeof GROUP_PARTS)[number];
export type ProfilePart = (typeof PROFILE_PARTS)[number];
export type PagePlace = "middle" | "side";
export interface PageSlot<P extends string = string> {
  id: P;
  side: PagePlace;
  on: boolean;
}

/** the kinds of things in the feed (its filters, but "all") */
export type FeedKind = Exclude<FeedFilter, "all">;
export const FEED_KINDS: FeedKind[] = ["posts", "news", "forum", "polls", "events", "lists"];
/** the feature (Admin → Features) a kind needs */
export const FEED_FEATURE: Record<FeedKind, keyof Features | null> = { posts: null, news: "news", forum: "forum", polls: "polls", events: "calendar", lists: "lists" };

export const DEFAULT_HOME: HomeLayout = {
  panels: [
    { id: "filters", side: "middle", on: true },
    { id: "chat", side: "left", on: true },
    { id: "forum", side: "left", on: true },
    { id: "lists", side: "left", on: true },
    { id: "calendar", side: "right", on: true },
    { id: "online", side: "right", on: true },
    { id: "polls", side: "right", on: true },
    { id: "groups", side: "right", on: true },
    { id: "news", side: "right", on: false },
  ],
  calendar: "month",
  feed: FEED_KINDS,
  hero: true,
  group: [
    { id: "filters", side: "middle", on: true },
    { id: "upcoming", side: "side", on: true },
    { id: "members", side: "side", on: true },
  ],
  profile: [
    { id: "filters", side: "middle", on: true },
    { id: "about", side: "side", on: true },
    { id: "groups", side: "side", on: true },
  ],
};

/** The feature (Admin → Features) a part needs: off there, it's not on the front page either. */
export const PANEL_FEATURE: Record<HomePanel, keyof Features | null> = {
  filters: null,
  calendar: "calendar",
  online: null,
  chat: "chat",
  forum: "forum",
  polls: "polls",
  lists: "lists",
  groups: "groups",
  news: "news",
};

const isPanel = (x: unknown): x is HomePanel => (HOME_PANELS as readonly unknown[]).includes(x);

/** A stored layout, cleaned: each part once, the missing ones at their default place. */
export function homeLayout(raw: unknown): HomeLayout {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof HomeLayout, unknown>>;
  const seen = new Set<HomePanel>();
  const panels: HomePanelSlot[] = [];
  for (const p of Array.isArray(r.panels) ? r.panels : []) {
    const x = (p && typeof p === "object" ? p : {}) as Partial<Record<keyof HomePanelSlot, unknown>>;
    if (!isPanel(x.id) || seen.has(x.id)) continue;
    seen.add(x.id);
    // (only the filters go in the middle)
    panels.push({ id: x.id, side: x.side === "left" ? "left" : x.side === "middle" && x.id === "filters" ? "middle" : "right", on: x.on !== false });
  }
  for (const d of DEFAULT_HOME.panels) if (!seen.has(d.id)) panels.push({ ...d });
  const feed = FEED_KINDS.filter((k) => Array.isArray(r.feed) && r.feed.includes(k));
  // (from before the side columns could be arranged: one choice for both, the filters above the feed or on top in the side column)
  const aside = (r as { pageFilters?: unknown }).pageFilters === "side";
  return {
    panels,
    calendar: r.calendar === "upcoming" ? "upcoming" : "month",
    feed: Array.isArray(r.feed) && feed.length ? feed : [...FEED_KINDS],
    hero: r.hero !== false,
    group: pageSlots(r.group, GROUP_PARTS, DEFAULT_HOME.group, aside),
    profile: pageSlots(r.profile, PROFILE_PARTS, DEFAULT_HOME.profile, aside),
  };
}

/** A stored side column (a group's, a profile's), cleaned: each part once, the missing ones at their default place. */
function pageSlots<P extends string>(raw: unknown, parts: readonly P[], defaults: PageSlot<P>[], filtersAside: boolean): PageSlot<P>[] {
  const seen = new Set<P>();
  const out: PageSlot<P>[] = [];
  for (const p of Array.isArray(raw) ? raw : []) {
    const x = (p && typeof p === "object" ? p : {}) as Partial<Record<keyof PageSlot, unknown>>;
    if (!parts.includes(x.id as P) || seen.has(x.id as P)) continue;
    seen.add(x.id as P);
    // (only the filters go above the feed)
    out.push({ id: x.id as P, side: x.side === "middle" && x.id === "filters" ? "middle" : "side", on: x.on !== false });
  }
  for (const d of defaults) if (!seen.has(d.id)) out.push({ ...d });
  return filtersAside ? out.map((p) => (p.id === "filters" && p.side === "middle" ? { ...p, side: "side" } : p)) : out;
}

/** A group's or a profile's side column: its parts that are on, in order (the filters only when they're there); and where the filters are (nowhere: off). */
export function pageColumn<P extends string>(slots: PageSlot<P>[]): { side: P[]; filters: PagePlace | null } {
  const f = slots.find((p) => p.id === "filters");
  return { side: slots.filter((p) => p.on && p.side === "side").map((p) => p.id), filters: f?.on ? f.side : null };
}

/** The parts that show, side by side: on, and their feature on (the filters too, when they're in a side column). */
export function shownPanels(layout: HomeLayout, features: Features): Record<HomeSide, HomePanel[]> {
  const on = layout.panels.filter((p) => p.on && (!PANEL_FEATURE[p.id] || features[PANEL_FEATURE[p.id]!]));
  return { left: on.filter((p) => p.side === "left").map((p) => p.id), right: on.filter((p) => p.side === "right").map((p) => p.id) };
}

/** where the feed's filters are on the front page: above the feed, in a side column, or nowhere (off) */
export function filtersPlace(layout: HomeLayout): HomePlace | null {
  const f = layout.panels.find((p) => p.id === "filters");
  return f?.on ? f.side : null;
}
