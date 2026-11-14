"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { EventView } from "@/lib/contentTypes";
import { useT } from "@/components/app/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { EventWhen } from "@/components/feed/EventCard";
import { Greeting, useGreeting } from "./Widgets";

export type CountdownEvent = Pick<EventView, "id" | "title" | "startAt" | "endAt" | "allDay" | "going">;

const p2 = (n: number) => String(n).padStart(2, "0");

/**
 * The front page's heading, counting down to an event that has a countdown (its form): "18 days to
 * Bolle", with the greeting moved up into the line above, and below it the rest of the time, when it
 * is and who's going. It ticks each second; once the event starts the greeting is back, and the page
 * looks again for the next one. `now` is the server's, so the first drawing matches its.
 */
export function CountdownHead({ name, e, now: start }: { name: string; e: CountdownEvent; now: number }) {
  const t = useT();
  const router = useRouter();
  const { hi, day } = useGreeting(name);
  const [now, setNow] = useState(start);
  useEffect(() => {
    // by the server's clock, which chose the event (a phone's own can be off): a touch behind it, by
    // the time the page took to come, so the server agrees it has started when it's asked again
    const skew = start - Date.now();
    const tick = () => setNow(Date.now() + skew);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [start]);
  const over = e.startAt <= now;
  // (rounded up: "1 second" until it has started)
  const left = Math.max(0, Math.ceil((e.startAt - now) / 1000));
  useEffect(() => {
    if (over) router.refresh();
  }, [over, router]);
  if (over) return <Greeting name={name} />;
  const d = Math.floor(left / 86400);
  const h = Math.floor(left / 3600) % 24;
  const m = Math.floor(left / 60) % 60;
  const s = left % 60;
  // the biggest whole unit in the heading, what's left of it below
  const [big, rest] = d
    ? [t.n(d, "{n} day", "{n} days"), t("{h} h {m} min {s} s", { h: p2(h), m: p2(m), s: p2(s) })]
    : h
      ? [t.n(h, "{n} hour", "{n} hours"), t("{m} min {s} s", { m: p2(m), s: p2(s) })]
      : m
        ? [t.n(m, "{n} minute", "{n} minutes"), t("{s} s", { s: p2(s) })]
        : [t.n(s, "{n} second", "{n} seconds"), ""];
  // (the time left in the event's colour: the wording around it is the language's)
  const [before, after = ""] = t("{left} to {title}", { title: e.title }).split("{left}");
  return (
    <div className="countdown-head">
      <span className="eyebrow" suppressHydrationWarning>
        {hi}
        {day ? ` · ${day}` : ""}
      </span>
      <h1 className="display page-title countdown-title">
        {before}
        <em>{big}</em>
        {after}
      </h1>
      <Link href={`/events/${e.id}`} className="countdown-sub">
        {rest ? <span className="mono countdown-rest">{rest}</span> : null}
        <span>
          <EventWhen e={e} />
        </span>
        {e.going.length ? (
          <span className="row countdown-going" title={e.going.map((u) => u.name).join(", ")}>
            <span className="avatar-stack">
              {e.going.slice(0, 5).map((u) => (
                <Avatar key={u.id} user={u} size={24} />
              ))}
            </span>
            {t("{n} going", { n: e.going.length })}
          </span>
        ) : null}
        <ArrowRight size={15} className="countdown-go" aria-hidden />
      </Link>
    </div>
  );
}
