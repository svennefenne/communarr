"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { EventView } from "@/lib/contentTypes";
import { useT, useToast } from "@/components/app/AppProvider";
import { eventsAction } from "@/app/actions/content";
import { clock, clockHour } from "@/lib/clock";
import { monthGrid, monthKey } from "@/lib/monthGrid";
import { Widget } from "./Widgets";

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** ISO 8601 week number (the one used where weeks start on Monday) */
function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7);
}

/** The days an event covers (one that runs over several shows on each). */
function daysOf(e: EventView): string[] {
  const out: string[] = [];
  const end = new Date(e.endAt - 1);
  for (let d = startOfDay(new Date(e.startAt)), i = 0; i < 62 && d <= end; i++, d = addDays(d, 1)) out.push(dayKey(d));
  return out.length ? out : [dayKey(new Date(e.startAt))];
}

/**
 * The front page's calendar as a month: its days (a dot in an event's colour on each day it's on),
 * and under them the month's events in a short list. ‹ › go a month back or on (the month's name
 * goes back to this one), and a day with events shows only those until it's clicked again.
 */
export function MonthWidget({ initial, planHref = "/events/new" }: { initial: { month: string; events: EventView[] }; planHref?: string }) {
  const t = useT();
  const toast = useToast();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [cache, setCache] = useState<Record<string, EventView[]>>(() => ({ [initial.month]: initial.events }));
  const [day, setDay] = useState<string | null>(null);
  const key = monthKey(month);
  const events = cache[key];
  const grid = useMemo(() => monthGrid(month), [month]);

  useEffect(() => {
    if (cache[key]) return;
    let gone = false;
    void eventsAction(grid.from.getTime(), grid.to.getTime()).then((r) => {
      if (gone) return;
      if (r.ok) setCache((c) => ({ ...c, [key]: r.data }));
      else toast(r.error, { kind: "err" });
    });
    return () => {
      gone = true;
    };
  }, [key, cache, grid, toast]);

  const byDay = useMemo(() => {
    const m = new Map<string, EventView[]>();
    for (const e of events ?? []) if (!e.cancelled) for (const k of daysOf(e)) m.set(k, [...(m.get(k) ?? []), e]);
    return m;
  }, [events]);

  // the month's own events (and ones running into it), or the clicked day's
  const first = month.getTime();
  const next = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime();
  const list = (events ?? []).filter((e) => (day ? daysOf(e).includes(day) : e.startAt < next && e.endAt > first));

  // the list starts at what's next (what's been is above it, a scroll away)
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const upcoming = el.querySelector<HTMLElement>(".mcal-ev:not(.past)");
    el.scrollTop = upcoming ? upcoming.offsetTop : 0;
  }, [key, day, events]);

  const now = Date.now();
  const today = dayKey(new Date());
  const thisMonth = monthKey(new Date()) === key;
  const weekNumbers = clock().weekStart === 1;
  const go = (n: number) => {
    setDay(null);
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  };
  const toThisMonth = () => {
    setDay(null);
    setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  };
  const monthName = month.toLocaleDateString(t.locale, { month: "long", year: "numeric" });
  const time = (e: EventView) => (e.allDay ? t("All day") : new Date(e.startAt).toLocaleTimeString(t.locale, { ...clockHour(), minute: "2-digit" }));

  return (
    <Widget title={t("Calendar")} icon={<CalendarDays size={14} />} href="/calendar" more={t("Open calendar")}>
      <div className={`mcal ${weekNumbers ? "with-weeks" : ""}`}>
        <div className="mcal-bar">
          <button type="button" className="icon-btn xs" onClick={() => go(-1)} aria-label={t("Previous month")}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="mcal-title" onClick={toThisMonth} title={thisMonth ? undefined : t("This month")}>
            {monthName}
          </button>
          <button type="button" className="icon-btn xs" onClick={() => go(1)} aria-label={t("Next month")}>
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="mcal-grid">
          <div className="mcal-row mcal-head" aria-hidden>
            {weekNumbers ? <span className="mcal-wk" aria-hidden /> : null}
            {grid.weeks[0].map((d) => (
              <span key={d.getDay()} className="mcal-wd">
                {d.toLocaleDateString(t.locale, { weekday: "short" }).replace(".", "").slice(0, 2)}
              </span>
            ))}
          </div>
          {grid.weeks.map((w) => (
            <div key={dayKey(w[0])} className="mcal-row">
              {weekNumbers ? (
                <span className="mcal-wk" title={t("Week {n}", { n: isoWeek(w[0]) })}>
                  {isoWeek(w[0])}
                </span>
              ) : null}
              {w.map((d) => {
                const k = dayKey(d);
                const on = byDay.get(k) ?? [];
                const cls = ["mcal-day", d.getMonth() !== month.getMonth() ? "out" : "", k === today ? "today" : "", k === day ? "picked" : "", on.length ? "has" : ""].filter(Boolean).join(" ");
                const label = d.toLocaleDateString(t.locale, { weekday: "long", day: "numeric", month: "long" });
                return on.length ? (
                  <button key={k} type="button" className={cls} onClick={() => setDay((x) => (x === k ? null : k))} aria-pressed={k === day} aria-label={`${label}: ${t.n(on.length, "{n} event", "{n} events")}`}>
                    {d.getDate()}
                    <span className="mcal-dots" aria-hidden>
                      {on.slice(0, 3).map((e) => (
                        <i key={`${e.id}-${e.startAt}`} style={{ background: e.color }} />
                      ))}
                    </span>
                  </button>
                ) : (
                  <span key={k} className={cls}>
                    {d.getDate()}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        {day ? (
          <div className="mcal-picked tiny">
            <b>{new Date(`${day}T12:00`).toLocaleDateString(t.locale, { weekday: "long", day: "numeric", month: "long" })}</b>
            <button type="button" className="link" onClick={() => setDay(null)}>
              <X size={12} /> {t("The whole month")}
            </button>
          </div>
        ) : null}
        <div className="mcal-list" ref={listRef}>
          {!events ? (
            <div className="mcal-empty tiny muted">{t("Loading…")}</div>
          ) : list.length ? (
            list.map((e) => {
              const d = new Date(e.startAt);
              const other = e.startAt < first;
              return (
                <Link key={`${e.id}-${e.startAt}`} href={`/events/${e.id}`} className={`mcal-ev ${e.endAt < now ? "past" : ""} ${e.cancelled ? "cancelled" : ""}`} style={{ ["--ec" as string]: e.color }}>
                  <span className="mcal-ev-date">
                    <b>{d.getDate()}</b>
                    <span>{other ? d.toLocaleDateString(t.locale, { month: "short" }).replace(".", "") : d.toLocaleDateString(t.locale, { weekday: "short" }).replace(".", "")}</span>
                  </span>
                  <span className="mcal-ev-title ellipsis">{e.title}</span>
                  {e.mine === "going" ? <Check size={13} className="mcal-ev-going" aria-label={t("Going")} /> : null}
                  <span className="mcal-ev-time">{time(e)}</span>
                </Link>
              );
            })
          ) : (
            <div className="mcal-empty tiny muted">
              {t("Nothing planned in {month}.", { month: month.toLocaleDateString(t.locale, { month: "long" }) })}{" "}
              <Link href={planHref} className="link">
                {t("Plan something")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </Widget>
  );
}
