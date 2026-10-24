"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, MapPin, Repeat, Users } from "lucide-react";
import type { EventView } from "@/lib/contentTypes";
import { useT } from "@/components/app/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { EventWhen } from "@/components/feed/EventCard";
import { describeRepeat } from "@/lib/repeat";
import { clock } from "@/lib/clock";

/**
 * A quick look at an event in the calendar: resting the pointer on it (or tabbing to it) shows a card
 * beside it with its picture, when and where, a bit of what it's about, and who's going. Only where
 * there's a pointer that hovers; a tap opens the event as before.
 */

interface Peek {
  e: EventView;
  at: DOMRect;
}

/** The handlers for an event's link in the calendar, and the card to show. */
export function usePeek() {
  const [peek, setPeek] = useState<Peek | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setPeek(null);
  }, []);
  // it sits where the event was: scrolling moves the event, so it goes
  useEffect(() => {
    if (!peek) return;
    window.addEventListener("scroll", hide, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", hide, { capture: true });
  }, [peek, hide]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const bind = useCallback(
    (e: EventView) => ({
      onMouseEnter: (ev: React.MouseEvent<HTMLElement>) => {
        if (!window.matchMedia("(hover: hover)").matches) return;
        const el = ev.currentTarget;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setPeek({ e, at: el.getBoundingClientRect() }), 250);
      },
      onMouseLeave: hide,
      onFocus: (ev: React.FocusEvent<HTMLElement>) => {
        if (ev.currentTarget.matches(":focus-visible")) setPeek({ e, at: ev.currentTarget.getBoundingClientRect() });
      },
      onBlur: hide,
    }),
    [hide],
  );
  return { peek, bind };
}

const snippet = (html: string) =>
  html
    .replace(/<(br|\/p|\/li|\/h\d)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

export function EventPeek({ peek }: { peek: Peek }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const { e, at } = peek;
  // beside the event (right, else left), else below or above it; always on screen
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const gap = 10;
    let left: number;
    let top: number;
    if (at.right + gap + w <= vw - 8) [left, top] = [at.right + gap, at.top];
    else if (at.left - gap - w >= 8) [left, top] = [at.left - gap - w, at.top];
    else {
      left = Math.min(Math.max(8, at.left), vw - w - 8);
      top = at.bottom + gap + h <= vh - 8 ? at.bottom + gap : at.top - gap - h;
    }
    top = Math.min(Math.max(8, top), vh - h - 8);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.visibility = "visible";
  }, [at, e]);
  const text = snippet(e.html);
  // (on the page itself, so nothing around the calendar can clip it)
  return createPortal(
    <div ref={ref} className="event-peek" role="tooltip" style={{ ["--ec" as string]: e.color }}>
      {e.cover ? <div className="event-peek-cover" style={{ backgroundImage: `url("${e.cover}")` }} /> : <div className="event-peek-bar" />}
      <div className="event-peek-body">
        <div className="event-peek-head">
          <b className="event-peek-title">{e.title}</b>
          {e.cancelled ? <span className="badge danger">{t("Cancelled")}</span> : e.mine === "going" ? <span className="badge accent">{t("Going")}</span> : e.mine === "maybe" ? <span className="badge">{t("Maybe")}</span> : null}
        </div>
        <div className="event-peek-row">
          <Clock size={13} />
          <span>
            <EventWhen e={e} />
          </span>
        </div>
        {e.repeat !== "none" ? (
          <div className="event-peek-row">
            <Repeat size={13} />
            <span>{describeRepeat(t, e, clock().weekStart)}</span>
          </div>
        ) : null}
        {e.location ? (
          <div className="event-peek-row">
            <MapPin size={13} />
            <span>{e.location}</span>
          </div>
        ) : null}
        {e.group ? (
          <div className="event-peek-row">
            <Users size={13} />
            <span>{e.group.name}</span>
          </div>
        ) : null}
        {text ? <p className="event-peek-text">{text}</p> : null}
        <div className="event-peek-foot">
          {e.going.length ? (
            <span className="avatar-stack">
              {e.going.slice(0, 5).map((u) => (
                <Avatar key={u.id} user={u} size={22} />
              ))}
            </span>
          ) : null}
          <span className="tiny muted">
            {e.capacity ? t("{n} going of {cap} places", { n: e.going.length, cap: e.capacity }) : t("{n} going", { n: e.going.length })}
            {e.maybe.length ? ` · ${t("{n} maybe", { n: e.maybe.length })}` : ""}
          </span>
        </div>
        <span className="tiny faint">{t("by {name}", { name: e.author.name })}</span>
      </div>
    </div>,
    document.body,
  );
}
