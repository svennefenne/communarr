"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, MapPin, Plus, Repeat, Rss } from "lucide-react";
import type { EventView } from "@/lib/contentTypes";
import { useApp, useToast } from "@/components/app/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/ui";
import { eventsAction } from "@/app/actions/content";

type View = "month" | "week" | "list";

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Monday-first weeks */
const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
const timeLabel = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

function rangeFor(view: View, anchor: Date): [Date, Date] {
  if (view === "month") {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = startOfWeek(first);
    return [start, addDays(start, 42)];
  }
  if (view === "week") {
    const s = startOfWeek(anchor);
    return [s, addDays(s, 7)];
  }
  const s = startOfDay(anchor);
  return [s, addDays(s, 90)];
}

/** Which days an event covers (multi-day events show on each). */
function daysOf(e: EventView): string[] {
  const out: string[] = [];
  let d = startOfDay(new Date(e.startAt));
  const end = new Date(e.endAt - 1);
  for (let i = 0; i < 62 && d <= end; i++, d = addDays(d, 1)) out.push(dayKey(d));
  return out.length ? out : [dayKey(new Date(e.startAt))];
}

function EventLine({ e, showDay = false }: { e: EventView; showDay?: boolean }) {
  return (
    <Link href={`/events/${e.id}`} className={`cal-line ${e.cancelled ? "cancelled" : ""}`} style={{ ["--ec" as string]: e.color }}>
      <span className="cal-line-time mono">
        {showDay ? new Date(e.startAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric" }) + " " : ""}
        {e.allDay ? "All day" : timeLabel(e.startAt)}
      </span>
      <span className="grow" style={{ minWidth: 0 }}>
        <b className="ellipsis" style={{ display: "block" }}>
          {e.title}
          {e.repeat !== "none" ? <Repeat size={11} style={{ marginLeft: 5, verticalAlign: -1 }} /> : null}
        </b>
        {e.location ? (
          <span className="tiny muted ellipsis" style={{ display: "block" }}>
            <MapPin size={11} style={{ verticalAlign: -1 }} /> {e.location}
          </span>
        ) : null}
      </span>
      {e.mine === "going" ? <span className="badge accent">Going</span> : e.mine === "maybe" ? <span className="badge">Maybe</span> : null}
      {e.going.length ? (
        <span className="avatar-stack">
          {e.going.slice(0, 3).map((u) => (
            <Avatar key={u.id} user={u} size={20} />
          ))}
        </span>
      ) : null}
    </Link>
  );
}

export function Calendar({ initial, feedUrl, canCreate, groupId }: { initial: EventView[]; feedUrl: { mine: string; all: string }; canCreate: boolean; groupId?: number }) {
  const { site } = useApp();
  const toast = useToast();
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [mineOnly, setMineOnly] = useState(false);
  const [events, setEvents] = useState<EventView[]>(initial);
  const [selected, setSelected] = useState(() => dayKey(new Date()));
  const [subscribe, setSubscribe] = useState(false);
  const [loading, setLoading] = useState(false);

  const [from, to] = useMemo(() => rangeFor(view, anchor), [view, anchor]);
  const load = useCallback(async () => {
    setLoading(true);
    const r = await eventsAction(from.getTime(), to.getTime(), { mineOnly, groupId });
    setLoading(false);
    if (r.ok) setEvents(r.data);
    else toast(r.error, { kind: "err" });
  }, [from, to, mineOnly, groupId, toast]);
  useEffect(() => {
    void load();
  }, [load]);

  const byDay = useMemo(() => {
    const m = new Map<string, EventView[]>();
    for (const e of events) for (const k of daysOf(e)) m.set(k, [...(m.get(k) ?? []), e]);
    for (const list of m.values()) list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startAt - b.startAt);
    return m;
  }, [events]);

  const step = (dir: -1 | 1) => {
    if (view === "month") setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir, 1));
    else if (view === "week") setAnchor((a) => addDays(a, 7 * dir));
    else setAnchor((a) => addDays(a, 90 * dir));
  };
  const today = dayKey(new Date());
  const title =
    view === "month"
      ? anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : view === "week"
        ? `${from.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${addDays(to, -1).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`
        : `From ${from.toLocaleDateString(undefined, { day: "numeric", month: "long" })}`;
  const weekdays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(new Date()), i).toLocaleDateString(undefined, { weekday: "short" }));
  const selectedEvents = byDay.get(selected) ?? [];
  const selectedDate = new Date(`${selected}T12:00`);
  const newLink = (day?: string) => `/events/new?${day ? `date=${day}` : ""}${groupId ? `&group=${groupId}` : ""}`;

  return (
    <div className="calendar">
      <div className="cal-bar">
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="icon-btn framed" onClick={() => step(-1)} aria-label="Back">
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setAnchor(new Date());
              setSelected(today);
            }}
          >
            Today
          </button>
          <button type="button" className="icon-btn framed" onClick={() => step(1)} aria-label="Forward">
            <ChevronRight size={18} />
          </button>
          <h2 className="h2 cal-title" suppressHydrationWarning>
            {title}
          </h2>
          {loading ? <span className="spin" style={{ width: 14, height: 14, border: "2px solid var(--muted)", borderRightColor: "transparent", borderRadius: "50%" }} /> : null}
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <div className="pills">
            {(["month", "week", "list"] as View[]).map((v) => (
              <button key={v} type="button" className={`pill ${view === v ? "active" : ""}`} onClick={() => setView(v)}>
                {v === "month" ? "Month" : v === "week" ? "Week" : "List"}
              </button>
            ))}
          </div>
          <div className="pills">
            <button type="button" className={`pill ${!mineOnly ? "active" : ""}`} onClick={() => setMineOnly(false)}>
              All
            </button>
            <button type="button" className={`pill ${mineOnly ? "active" : ""}`} onClick={() => setMineOnly(true)}>
              Mine
            </button>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => setSubscribe(true)} title="Put the calendar in your phone's calendar app">
            <Rss size={15} /> Subscribe
          </button>
          {canCreate && site.can.events ? (
            <Link href={newLink(view === "month" ? selected : undefined)} className="btn btn-primary btn-sm">
              <Plus size={15} /> New event
            </Link>
          ) : null}
        </div>
      </div>

      {view === "month" ? (
        <div className="cal-month-wrap">
          <div className="panel cal-month">
            {weekdays.map((w) => (
              <div key={w} className="cal-wd" suppressHydrationWarning>
                {w}
              </div>
            ))}
            {Array.from({ length: 42 }, (_, i) => {
              const d = addDays(from, i);
              const k = dayKey(d);
              const list = byDay.get(k) ?? [];
              const other = d.getMonth() !== anchor.getMonth();
              return (
                <div
                  key={k}
                  role="button"
                  tabIndex={0}
                  className={`cal-cell ${other ? "other" : ""} ${k === today ? "today" : ""} ${k === selected ? "sel" : ""}`}
                  onClick={() => setSelected(k)}
                  onKeyDown={(e) => e.key === "Enter" && setSelected(k)}
                  aria-label={d.toDateString()}
                >
                  <span className="cal-num">{d.getDate()}</span>
                  <span className="cal-chips">
                    {list.slice(0, 3).map((e) => (
                      <Link key={`${e.id}-${e.startAt}`} href={`/events/${e.id}`} className={`cal-chip ${e.cancelled ? "cancelled" : ""} ${e.mine === "going" ? "going" : ""}`} style={{ ["--ec" as string]: e.color }} onClick={(ev) => ev.stopPropagation()} title={e.title}>
                        {!e.allDay && daysOf(e)[0] === k ? <span className="mono">{timeLabel(e.startAt)}</span> : null} {e.title}
                      </Link>
                    ))}
                    {list.length > 3 ? <span className="cal-more">+{list.length - 3} more</span> : null}
                  </span>
                  <span className="cal-dots">
                    {list.slice(0, 4).map((e) => (
                      <i key={`${e.id}-${e.startAt}`} style={{ background: e.color }} />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="panel cal-day">
            <div className="panel-head">
              <span className="eyebrow" suppressHydrationWarning>
                {selectedDate.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
              </span>
              {canCreate && site.can.events ? (
                <Link href={newLink(selected)} className="btn btn-ghost btn-xs">
                  <CalendarPlus size={14} /> Plan
                </Link>
              ) : null}
            </div>
            <div className="list">
              {selectedEvents.length ? selectedEvents.map((e) => <EventLine key={`${e.id}-${e.startAt}`} e={e} />) : <div className="panel-body small muted">Nothing on this day.</div>}
            </div>
          </div>
        </div>
      ) : view === "week" ? (
        <div className="cal-week">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(from, i);
            const k = dayKey(d);
            const list = byDay.get(k) ?? [];
            return (
              <div key={k} className={`panel cal-week-day ${k === today ? "today" : ""}`}>
                <div className="cal-week-head">
                  <span className="eyebrow" suppressHydrationWarning>
                    {d.toLocaleDateString(undefined, { weekday: "short" })}
                  </span>
                  <span className="cal-week-num">{d.getDate()}</span>
                  {canCreate && site.can.events ? (
                    <Link href={newLink(k)} className="icon-btn xs" aria-label="Plan something on this day">
                      <Plus size={14} />
                    </Link>
                  ) : null}
                </div>
                <div className="list">{list.length ? list.map((e) => <EventLine key={`${e.id}-${e.startAt}`} e={e} />) : <div className="tiny faint" style={{ padding: "6px 12px 10px" }}>—</div>}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="stack">
          {[...byDay.entries()]
            .filter(([k]) => k >= dayKey(from))
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, list]) => (
              <div key={k} className="panel">
                <div className="panel-head">
                  <span className="eyebrow" suppressHydrationWarning>
                    {new Date(`${k}T12:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
                    {k === today ? " · today" : ""}
                  </span>
                </div>
                <div className="list">
                  {list.map((e) => (
                    <EventLine key={`${e.id}-${e.startAt}`} e={e} />
                  ))}
                </div>
              </div>
            ))}
          {!byDay.size ? <div className="panel panel-pad muted">Nothing planned in the next three months.</div> : null}
        </div>
      )}

      {subscribe ? (
        <Modal title="Subscribe in your calendar app" onClose={() => setSubscribe(false)}>
          <div className="stack small">
            <p style={{ margin: 0 }}>Your phone or computer&apos;s calendar can show the events and keep them up to date. Pick what to show:</p>
            {(
              [
                ["What I'm going to", feedUrl.mine],
                ["Everything I can see", feedUrl.all],
              ] as const
            ).map(([label, url]) => (
              <div key={label} className="inset panel-pad-sm stack tight">
                <b>{label}</b>
                <div className="row wrap">
                  <a className="btn btn-primary btn-sm" href={url.replace(/^https?:/, "webcal:")}>
                    <CalendarPlus size={15} /> Add to calendar
                  </a>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() =>
                      navigator.clipboard?.writeText(url).then(
                        () => toast("Address copied."),
                        () => toast(url),
                      )
                    }
                  >
                    Copy address
                  </button>
                </div>
                <code className="tiny muted" style={{ wordBreak: "break-all" }}>
                  {url}
                </code>
              </div>
            ))}
            <p className="muted" style={{ margin: 0 }}>
              Google Calendar: Other calendars → + → From URL, and paste the address. The address is private to you: don&apos;t share it.
            </p>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
