"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown, ChevronUp, GripVertical, ListChecks, ListFilter, MessageCircle, MessagesSquare, Newspaper, Users, UsersRound, Vote, type LucideIcon } from "lucide-react";
import type { SiteSettings } from "@/lib/settings";
import { FEED_FEATURE, FEED_KINDS, homeLayout, PANEL_FEATURE, type FeedKind, type HomeLayout as Layout, type HomePanel, type HomePanelSlot, type HomePlace } from "@/lib/homePanels";
import { useT, useToast } from "@/components/app/AppProvider";
import { Switch } from "@/components/ui/ui";
import { saveSettingsAction } from "@/app/actions/admin";
import { SaveBar } from "./Section";

const PANELS: Record<HomePanel, { label: string; icon: LucideIcon }> = {
  filters: { label: "The feed's filters", icon: ListFilter },
  calendar: { label: "Calendar", icon: CalendarDays },
  online: { label: "Here now", icon: Users },
  chat: { label: "Chat", icon: MessageCircle },
  forum: { label: "Forum", icon: MessagesSquare },
  polls: { label: "Polls", icon: Vote },
  lists: { label: "Lists", icon: ListChecks },
  groups: { label: "Groups", icon: UsersRound },
  news: { label: "News", icon: Newspaper },
};

const KIND_LABEL: Record<FeedKind, string> = { posts: "Posts", news: "News", forum: "Forum", polls: "Polls", events: "Events", lists: "Lists" };

type Cols = Record<HomePlace, HomePanelSlot[]>;
const PLACES: HomePlace[] = ["left", "middle", "right"];
const split = (l: Layout): Cols => ({ left: l.panels.filter((p) => p.side === "left"), middle: l.panels.filter((p) => p.side === "middle"), right: l.panels.filter((p) => p.side === "right") });
/** the column a step to the left or right (the middle only for the filters) */
const step = (id: HomePanel, from: HomePlace, dir: -1 | 1): HomePlace | null => {
  const places = id === "filters" ? PLACES : PLACES.filter((p) => p !== "middle");
  return places[places.indexOf(from) + dir] ?? null;
};

/**
 * Admin → Front page: the parts in the front page's side columns. Drag a part by its handle, within
 * its column or over to the other one, or move it with the arrows (phones, keyboards); its switch
 * takes it off the page. The feed is in the middle, always; the feed's filters go above it, or in a
 * side column.
 */
export function HomeLayoutSettings({ s }: { s: SiteSettings }) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cols, setCols] = useState<Cols>(() => split(homeLayout(s.home)));
  const [calendar, setCalendar] = useState(() => homeLayout(s.home).calendar);
  const [kinds, setKinds] = useState(() => homeLayout(s.home).feed);
  const [hero, setHero] = useState(() => homeLayout(s.home).hero);
  const [pageFilters, setPageFilters] = useState(() => homeLayout(s.home).pageFilters);
  const [dragging, setDragging] = useState<HomePanel | null>(null);
  const dragRef = useRef<HomePanel | null>(null);

  /** a part to a column, at a place in it (the end, past the last); only the filters go in the middle */
  const move = (id: HomePanel, side: HomePlace, at: number) =>
    setCols((c) => {
      if (side === "middle" && id !== "filters") return c;
      const from = PLACES.find((x) => c[x].some((p) => p.id === id))!;
      const now = c[from].findIndex((p) => p.id === id);
      if (from === side && now === at) return c;
      const item = { ...c[from][now], side };
      const next: Cols = { left: c.left.filter((p) => p.id !== id), middle: c.middle.filter((p) => p.id !== id), right: c.right.filter((p) => p.id !== id) };
      const i = Math.max(0, Math.min(at, next[side].length));
      next[side] = [...next[side].slice(0, i), item, ...next[side].slice(i)];
      return next;
    });
  const end = () => {
    dragRef.current = null;
    setDragging(null);
  };
  const toggle = (id: HomePanel, on: boolean) => setCols((c) => ({ left: c.left.map((p) => (p.id === id ? { ...p, on } : p)), middle: c.middle.map((p) => (p.id === id ? { ...p, on } : p)), right: c.right.map((p) => (p.id === id ? { ...p, on } : p)) }));
  /** what's dragged may go in this column */
  const takes = (side: HomePlace) => !!dragRef.current && (side !== "middle" || dragRef.current === "filters");

  const row = (p: HomePanelSlot, i: number, side: HomePlace) => {
    const { label, icon: Icon } = PANELS[p.id];
    const name = t(label);
    const feature = PANEL_FEATURE[p.id];
    const off = feature && !s.features[feature];
    const left = step(p.id, side, -1);
    const right = step(p.id, side, 1);
    const sideways = (to: HomePlace, dir: -1 | 1) => (
      <button
        type="button"
        className="icon-btn xs"
        onClick={() => move(p.id, to, to === "middle" ? 0 : cols[to].length)}
        aria-label={t(to === "middle" ? "Move {name} above the feed" : to === "left" ? "Move {name} to the left" : "Move {name} to the right", { name })}
        title={t(to === "middle" ? "Above the feed" : to === "left" ? "To the left" : "To the right")}
      >
        {dir < 0 ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}
      </button>
    );
    return (
      <li
        key={p.id}
        className={`home-arrange-row ${dragging === p.id ? "dragging" : ""} ${p.on && !off ? "" : "off"}`}
        draggable
        onDragStart={(e) => {
          dragRef.current = p.id;
          setDragging(p.id);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", p.id);
        }}
        onDragOver={(e) => {
          const id = dragRef.current;
          if (!id || !takes(side)) return;
          e.preventDefault();
          e.stopPropagation();
          if (id === p.id) return;
          // the upper half: before it; the lower: after it
          const r = e.currentTarget.getBoundingClientRect();
          const after = e.clientY > r.top + r.height / 2;
          const mine = cols[side].findIndex((x) => x.id === id);
          let at = i + (after ? 1 : 0);
          if (mine !== -1 && mine < at) at -= 1;
          move(id, side, at);
        }}
        onDragEnd={end}
      >
        <GripVertical size={16} className="muted arrange-grip" aria-hidden />
        <Icon size={16} className="home-arrange-icon" aria-hidden />
        <span className="grow" style={{ minWidth: 0 }}>
          <b className="ellipsis" style={{ display: "block" }}>
            {name}
          </b>
          {off ? <span className="tiny muted">{t("Off under Features & permissions")}</span> : null}
        </span>
        {side === "middle" ? null : (
          <>
            <button type="button" className="icon-btn xs" onClick={() => move(p.id, side, i - 1)} disabled={i === 0} aria-label={t("Move {name} up", { name })}>
              <ChevronUp size={15} />
            </button>
            <button type="button" className="icon-btn xs" onClick={() => move(p.id, side, i + 1)} disabled={i === cols[side].length - 1} aria-label={t("Move {name} down", { name })}>
              <ChevronDown size={15} />
            </button>
          </>
        )}
        {left ? sideways(left, -1) : null}
        {right ? sideways(right, 1) : null}
        <Switch on={p.on} onChange={(v) => toggle(p.id, v)} label={t("Show {name}", { name })} />
      </li>
    );
  };

  const column = (side: HomePlace) => (
    <div className={`home-arrange-col ${side === "middle" ? "mid" : ""}`}>
      <span className="label">{t(side === "left" ? "Left" : side === "right" ? "Right" : "Middle")}</span>
      <ol
        className={`home-arrange-list ${dragging && takes(side) && !cols[side].some((p) => p.id === dragging) ? "drop" : ""}`}
        onDragOver={(e) => {
          if (!dragRef.current || !takes(side)) return;
          e.preventDefault();
          // over the column's empty end: to its end
          if (e.target === e.currentTarget && !cols[side].some((p) => p.id === dragRef.current)) move(dragRef.current, side, cols[side].length);
        }}
        onDrop={(e) => {
          e.preventDefault();
          end();
        }}
      >
        {cols[side].map((p, i) => row(p, i, side))}
        {side === "middle" ? (
          <li className="home-arrange-feed" aria-hidden>
            <Newspaper size={18} />
            <span className="small">{t("The feed")}</span>
          </li>
        ) : cols[side].length ? null : (
          <li className="home-arrange-empty tiny muted">{t("Nothing here: the feed takes the room.")}</li>
        )}
      </ol>
    </div>
  );

  return (
    <div className="stack loose">
      <p className="small muted" style={{ margin: 0 }}>
        {t("What's beside the feed on the front page, for everyone. Drag the parts by the handle, from one side to the other too, or use the arrows; the switch takes a part off the page. The feed's filters can go above the feed too. On a screen narrower than 1280 px the left side's parts come last on the right (the filters first), and phones show neither (the filters are above the feed there).")}
      </p>
      <div className="home-arrange">
        {column("left")}
        {column("middle")}
        {column("right")}
      </div>
      <div className="setting-row">
        <span className="grow">
          <b>{t("The calendar shows")}</b>
          <span className="small muted">{t("The month: its days, and its events under them. Or what's coming up next.")}</span>
        </span>
        <div className="pills">
          <button type="button" className={`pill ${calendar === "month" ? "active" : ""}`} onClick={() => setCalendar("month")}>
            {t("Month")}
          </button>
          <button type="button" className={`pill ${calendar === "upcoming" ? "active" : ""}`} onClick={() => setCalendar("upcoming")}>
            {t("Coming up")}
          </button>
        </div>
      </div>
      <div className="setting-row">
        <span className="grow">
          <b>{t("The feed shows")}</b>
          <span className="small muted">{t("What's in the feed in the middle, and in its filters. One at least.")}</span>
        </span>
        <div className="pills" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
          {FEED_KINDS.map((k) => {
            const on = kinds.includes(k);
            const feature = FEED_FEATURE[k];
            const off = feature && !s.features[feature];
            return (
              <button
                key={k}
                type="button"
                className={`pill ${on ? "active" : ""}`}
                aria-pressed={on}
                disabled={!!off || (on && kinds.length === 1)}
                title={off ? t("Off under Features & permissions") : undefined}
                onClick={() => setKinds((x) => FEED_KINDS.filter((y) => (y === k ? !on : x.includes(y))))}
              >
                {t(KIND_LABEL[k])}
              </button>
            );
          })}
        </div>
      </div>
      <div className="setting-row">
        <span className="grow">
          <b>{t("News banner")}</b>
          <span className="small muted">{t("Pinned news, or news from the last week, in a banner above the feed.")}</span>
        </span>
        <Switch on={hero} onChange={setHero} label={t("News banner")} />
      </div>
      <div className="setting-row">
        <span className="grow">
          <b>{t("Filters on groups and profiles")}</b>
          <span className="small muted">{t("A group's feed and a member's: their filters above the feed, or on top in the side column. Phones have them above the feed.")}</span>
        </span>
        <div className="pills">
          <button type="button" className={`pill ${pageFilters === "feed" ? "active" : ""}`} onClick={() => setPageFilters("feed")}>
            {t("Above the feed")}
          </button>
          <button type="button" className={`pill ${pageFilters === "side" ? "active" : ""}`} onClick={() => setPageFilters("side")}>
            {t("In the side column")}
          </button>
        </div>
      </div>
      <SaveBar
        pending={pending}
        onSave={() =>
          start(async () => {
            const r = await saveSettingsAction({ home: { panels: [...cols.left, ...cols.middle, ...cols.right], calendar, feed: kinds, hero, pageFilters } });
            if (!r.ok) toast(r.error, { kind: "err" });
            else {
              toast(t("Saved. The front page looks like this now, for everyone."));
              router.refresh();
            }
          })
        }
      />
    </div>
  );
}
