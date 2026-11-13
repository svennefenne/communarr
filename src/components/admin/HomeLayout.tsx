"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown, ChevronUp, GripVertical, ListChecks, MessageCircle, MessagesSquare, Newspaper, Users, UsersRound, Vote, type LucideIcon } from "lucide-react";
import type { SiteSettings } from "@/lib/settings";
import { FEED_FEATURE, FEED_KINDS, homeLayout, PANEL_FEATURE, type FeedKind, type HomeLayout as Layout, type HomePanel, type HomePanelSlot, type HomeSide } from "@/lib/homePanels";
import { useT, useToast } from "@/components/app/AppProvider";
import { Switch } from "@/components/ui/ui";
import { saveSettingsAction } from "@/app/actions/admin";
import { SaveBar } from "./Section";

const PANELS: Record<HomePanel, { label: string; icon: LucideIcon }> = {
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

type Cols = Record<HomeSide, HomePanelSlot[]>;
const split = (l: Layout): Cols => ({ left: l.panels.filter((p) => p.side === "left"), right: l.panels.filter((p) => p.side === "right") });
const other = (s: HomeSide): HomeSide => (s === "left" ? "right" : "left");

/**
 * Admin → Front page: the parts in the front page's side columns. Drag a part by its handle, within
 * its column or over to the other one, or move it with the arrows (phones, keyboards); its switch
 * takes it off the page. The feed is in the middle, always.
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
  const [dragging, setDragging] = useState<HomePanel | null>(null);
  const dragRef = useRef<HomePanel | null>(null);

  /** a part to a side, at a place in it (the end, past the last) */
  const move = (id: HomePanel, side: HomeSide, at: number) =>
    setCols((c) => {
      const from: HomeSide = c.left.some((p) => p.id === id) ? "left" : "right";
      const now = c[from].findIndex((p) => p.id === id);
      if (from === side && now === at) return c;
      const item = { ...c[from][now], side };
      const next: Cols = { left: c.left.filter((p) => p.id !== id), right: c.right.filter((p) => p.id !== id) };
      const i = Math.max(0, Math.min(at, next[side].length));
      next[side] = [...next[side].slice(0, i), item, ...next[side].slice(i)];
      return next;
    });
  const end = () => {
    dragRef.current = null;
    setDragging(null);
  };
  const toggle = (id: HomePanel, on: boolean) => setCols((c) => ({ left: c.left.map((p) => (p.id === id ? { ...p, on } : p)), right: c.right.map((p) => (p.id === id ? { ...p, on } : p)) }));

  const column = (side: HomeSide) => (
    <div className="home-arrange-col">
      <span className="label">{t(side === "left" ? "Left" : "Right")}</span>
      <ol
        className={`home-arrange-list ${dragging && !cols[side].some((p) => p.id === dragging) ? "drop" : ""}`}
        onDragOver={(e) => {
          if (!dragRef.current) return;
          e.preventDefault();
          // over the column's empty end: to its end
          if (e.target === e.currentTarget && !cols[side].some((p) => p.id === dragRef.current)) move(dragRef.current, side, cols[side].length);
        }}
        onDrop={(e) => {
          e.preventDefault();
          end();
        }}
      >
        {cols[side].map((p, i) => {
          const { label, icon: Icon } = PANELS[p.id];
          const name = t(label);
          const feature = PANEL_FEATURE[p.id];
          const off = feature && !s.features[feature];
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
                if (!id) return;
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
              <button type="button" className="icon-btn xs" onClick={() => move(p.id, side, i - 1)} disabled={i === 0} aria-label={t("Move {name} up", { name })}>
                <ChevronUp size={15} />
              </button>
              <button type="button" className="icon-btn xs" onClick={() => move(p.id, side, i + 1)} disabled={i === cols[side].length - 1} aria-label={t("Move {name} down", { name })}>
                <ChevronDown size={15} />
              </button>
              <button type="button" className="icon-btn xs" onClick={() => move(p.id, other(side), cols[other(side)].length)} aria-label={t(side === "left" ? "Move {name} to the right" : "Move {name} to the left", { name })} title={t(side === "left" ? "To the right" : "To the left")}>
                {side === "left" ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
              </button>
              <Switch on={p.on} onChange={(v) => toggle(p.id, v)} label={t("Show {name}", { name })} />
            </li>
          );
        })}
        {cols[side].length ? null : <li className="home-arrange-empty tiny muted">{t("Nothing here: the feed takes the room.")}</li>}
      </ol>
    </div>
  );

  return (
    <div className="stack loose">
      <p className="small muted" style={{ margin: 0 }}>
        {t("What's beside the feed on the front page, for everyone. Drag the parts by the handle, from one side to the other too, or use the arrows; the switch takes a part off the page. On a screen narrower than 1280 px the left side's parts come last on the right, and phones show neither.")}
      </p>
      <div className="home-arrange">
        {column("left")}
        <div className="home-arrange-col" aria-hidden>
          <span className="label">{t("Middle")}</span>
          <div className="home-arrange-feed">
            <Newspaper size={18} />
            <span className="small">{t("The feed")}</span>
          </div>
        </div>
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
      <SaveBar
        pending={pending}
        onSave={() =>
          start(async () => {
            const r = await saveSettingsAction({ home: { panels: [...cols.left, ...cols.right], calendar, feed: kinds, hero } });
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
