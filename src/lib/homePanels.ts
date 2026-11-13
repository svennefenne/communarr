import type { Features } from "./bootTypes";
import type { FeedFilter } from "./contentTypes";

/**
 * The front page (Admin → Front page): which parts are in its side columns, on which side, in what
 * order, and how the calendar shows; and what its feed shows. One layout for everyone. Kept in the setting "home"; read
 * it through homeLayout, which fills in a part added later (at its default place) and drops anything odd.
 */

export const HOME_PANELS = ["calendar", "online", "chat", "forum", "polls", "lists", "groups", "news"] as const;
export type HomePanel = (typeof HOME_PANELS)[number];
export type HomeSide = "left" | "right";

export interface HomePanelSlot {
  id: HomePanel;
  side: HomeSide;
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
}

/** the kinds of things in the feed (its filters, but "all") */
export type FeedKind = Exclude<FeedFilter, "all">;
export const FEED_KINDS: FeedKind[] = ["posts", "news", "forum", "polls", "events", "lists"];
/** the feature (Admin → Features) a kind needs */
export const FEED_FEATURE: Record<FeedKind, keyof Features | null> = { posts: null, news: "news", forum: "forum", polls: "polls", events: "calendar", lists: "lists" };

export const DEFAULT_HOME: HomeLayout = {
  panels: [
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
};

/** The feature (Admin → Features) a part needs: off there, it's not on the front page either. */
export const PANEL_FEATURE: Record<HomePanel, keyof Features | null> = {
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
    panels.push({ id: x.id, side: x.side === "left" ? "left" : "right", on: x.on !== false });
  }
  for (const d of DEFAULT_HOME.panels) if (!seen.has(d.id)) panels.push({ ...d });
  const feed = FEED_KINDS.filter((k) => Array.isArray(r.feed) && r.feed.includes(k));
  return { panels, calendar: r.calendar === "upcoming" ? "upcoming" : "month", feed: Array.isArray(r.feed) && feed.length ? feed : [...FEED_KINDS], hero: r.hero !== false };
}

/** The parts that show, side by side: on, and their feature on. */
export function shownPanels(layout: HomeLayout, features: Features): Record<HomeSide, HomePanel[]> {
  const on = layout.panels.filter((p) => p.on && (!PANEL_FEATURE[p.id] || features[PANEL_FEATURE[p.id]!]));
  return { left: on.filter((p) => p.side === "left").map((p) => p.id), right: on.filter((p) => p.side === "right").map((p) => p.id) };
}
