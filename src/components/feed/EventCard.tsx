"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { CalendarCheck, CalendarDays, Check, HelpCircle, Lock, MapPin, Repeat, X } from "lucide-react";
import type { EventView, RsvpStatus } from "@/lib/contentTypes";
import { useMe, useT, useToast } from "@/components/app/AppProvider";
import { Avatar, UserLink } from "@/components/ui/Avatar";
import { Time } from "@/components/ui/Time";
import { rsvpAction } from "@/app/actions/content";
import { GroupChip } from "./PostCard";

/** English: translate where shown, t(REPEAT_LABEL[e.repeat]). */
export const REPEAT_LABEL = { none: "", daily: "Every day", weekly: "Every week", monthly: "Every month", yearly: "Every year" } as const;

/** The date as a little calendar page. */
export function DateTile({ t, color, small = false }: { t: number; color?: string; small?: boolean }) {
  const tr = useT();
  // drawn again once in the browser, in the reader's own time zone
  const [, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const date = new Date(t);
  return (
    <span className={`date-tile ${small ? "small" : ""}`} style={color ? ({ ["--dt" as string]: color } as React.CSSProperties) : undefined} suppressHydrationWarning>
      <span className="dt-m" suppressHydrationWarning>
        {date.toLocaleDateString(tr.locale, { month: "short" })}
      </span>
      <span className="dt-d" suppressHydrationWarning>
        {date.getDate()}
      </span>
      {!small ? (
        <span className="dt-w" suppressHydrationWarning>
          {date.toLocaleDateString(tr.locale, { weekday: "short" })}
        </span>
      ) : null}
    </span>
  );
}

/** When an event is, in words. */
export function EventWhen({ e }: { e: Pick<EventView, "startAt" | "endAt" | "allDay"> }) {
  const t = useT();
  const sameDay = new Date(e.startAt).toDateString() === new Date(e.endAt).toDateString();
  if (e.allDay)
    return sameDay ? (
      <>
        <Time t={e.startAt} mode="day" /> · {t("all day")}
      </>
    ) : (
      <>
        <Time t={e.startAt} mode="date" /> – <Time t={e.endAt} mode="date" />
      </>
    );
  return sameDay ? (
    <>
      <Time t={e.startAt} mode="day" /> · <Time t={e.startAt} mode="time" />–<Time t={e.endAt} mode="time" />
    </>
  ) : (
    <>
      <Time t={e.startAt} mode="datetime" /> – <Time t={e.endAt} mode="datetime" />
    </>
  );
}

/** Going, maybe, can't. */
export function RsvpButtons({ e, onChange, size = "sm" }: { e: EventView; onChange: (e: EventView) => void; size?: "sm" | "md" }) {
  const t = useT();
  const toast = useToast();
  const [pending, start] = useTransition();
  if (e.cancelled) return <span className="pill danger">{t("Cancelled")}</span>;
  const past = e.endAt < Date.now();
  const set = (s: RsvpStatus) =>
    start(async () => {
      const r = await rsvpAction(e.id, e.mine === s ? null : s);
      if (r.ok && r.data) onChange({ ...r.data, occurrence: e.occurrence, startAt: e.startAt, endAt: e.endAt });
      else if (!r.ok) toast(r.error, { kind: "err" });
    });
  const full = !!e.capacity && e.going.length >= e.capacity && e.mine !== "going";
  const cls = size === "sm" ? "btn btn-sm" : "btn";
  return (
    <div className={`rsvp ${pending ? "busy" : ""}`} role="group" aria-label={t("Are you going?")}>
      <button type="button" className={`${cls} ${e.mine === "going" ? "btn-primary" : ""}`} onClick={() => set("going")} disabled={past || full} aria-pressed={e.mine === "going"} title={full ? t("It's full") : undefined}>
        <Check size={15} /> {e.mine === "going" ? t("Going") : full ? t("Full{event}", { event: "" }) : t("Going")}
      </button>
      <button type="button" className={`${cls} ${e.mine === "maybe" ? "btn-secondary" : ""}`} onClick={() => set("maybe")} disabled={past} aria-pressed={e.mine === "maybe"}>
        <HelpCircle size={15} /> {t("Maybe")}
      </button>
      <button type="button" className={`${cls} ${e.mine === "no" ? "btn-danger" : ""}`} onClick={() => set("no")} disabled={past} aria-pressed={e.mine === "no"}>
        <X size={15} /> {t("Can't")}
      </button>
    </div>
  );
}

export function EventCard({ event, compact = false }: { event: EventView; compact?: boolean }) {
  const me = useMe();
  const t = useT();
  const [e, setE] = useState(event);
  const url = `/events/${e.id}`;
  return (
    <article className={`panel event-card ${e.cancelled ? "cancelled" : ""}`} style={{ ["--ec" as string]: e.color }}>
      {!compact ? (
        <header className="post-head">
          <span className="kind-icon event">
            <CalendarDays size={20} />
          </span>
          <div className="grow small">
            <UserLink user={e.author} /> <span className="muted">{t("planned something")}</span> {e.group ? <GroupChip g={e.group} /> : null}
            {e.private ? <span className="muted"> · <Lock size={11} style={{ verticalAlign: "-1px" }} /> {t("only you")}</span> : null}
            <div className="tiny muted">
              <Time t={e.createdAt} />
            </div>
          </div>
        </header>
      ) : null}
      <div className="event-row">
        <Link href={url}>
          <DateTile t={e.startAt} color={e.color} />
        </Link>
        <div className="grow" style={{ minWidth: 0 }}>
          <Link href={url} className="h3 event-title">
            {e.cancelled ? <s>{e.title}</s> : e.title}
          </Link>
          <div className="small dim event-when">
            <EventWhen e={e} />
            {e.repeat !== "none" ? (
              <span className="row" style={{ gap: 4, display: "inline-flex", marginLeft: 6 }}>
                <Repeat size={12} /> {t(REPEAT_LABEL[e.repeat])}
              </span>
            ) : null}
          </div>
          {e.location ? (
            <div className="small muted row" style={{ gap: 4, marginTop: 2 }}>
              <MapPin size={13} /> <span className="ellipsis">{e.location}</span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="event-foot">
        {e.going.length ? (
          <span className="row" style={{ gap: 6 }} title={e.going.map((u) => u.name).join(", ")}>
            <span className="avatar-stack">
              {e.going.slice(0, 6).map((u) => (
                <Avatar key={u.id} user={u} size={24} />
              ))}
            </span>
            <span className="small muted">
              <CalendarCheck size={13} style={{ verticalAlign: -2 }} /> {e.capacity ? t("{n} of {max} going", { n: e.going.length, max: e.capacity }) : t("{n} going", { n: e.going.length })}
              {e.maybe.length ? ` · ${t("{n} maybe", { n: e.maybe.length })}` : ""}
            </span>
          </span>
        ) : (
          <span className="small muted">{t(me ? "Nobody yet: be the first!" : "Nobody yet")}</span>
        )}
        <span className="spacer" />
        <RsvpButtons e={e} onChange={setE} />
      </div>
    </article>
  );
}
