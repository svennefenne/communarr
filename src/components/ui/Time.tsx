"use client";

import { useEffect, useState } from "react";
import { clientT } from "@/lib/i18n";
import { clockHour, hourCycle } from "@/lib/clock";

/** Dates in the reader's own time zone and words ("5 min ago"), formatted in the browser. */

export function relative(t: number, nowMs = Date.now()): string {
  const tr = clientT();
  const s = Math.round((nowMs - t) / 1000);
  const future = s < 0;
  const a = Math.abs(s);
  if (a < 45) return future ? tr("in a moment") : tr("just now");
  if (a < 3600) {
    const n = Math.round(a / 60);
    return future ? tr("in {n} min", { n }) : tr("{n} min ago", { n });
  }
  if (a < 86400) {
    const n = Math.round(a / 3600);
    return future ? tr.n(n, "in {n} hour", "in {n} hours") : tr.n(n, "{n} hour ago", "{n} hours ago");
  }
  if (a < 7 * 86400) {
    const n = Math.round(a / 86400);
    if (n === 1) return future ? tr("tomorrow") : tr("yesterday");
    return future ? tr("in {n} days", { n }) : tr("{n} days ago", { n });
  }
  return dateLabel(t);
}

export function dateLabel(t: number) {
  const d = new Date(t);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(clientT().locale, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

export function timeLabel(t: number) {
  return new Date(t).toLocaleTimeString(clientT().locale, { ...clockHour(), minute: "2-digit" });
}

export function dateTimeLabel(t: number) {
  return new Date(t).toLocaleString(clientT().locale, { weekday: "short", day: "numeric", month: "short", ...clockHour(), minute: "2-digit" });
}

export function fullLabel(t: number) {
  return new Date(t).toLocaleString(clientT().locale, { dateStyle: "full", timeStyle: "short", ...hourCycle() });
}

type Mode = "relative" | "date" | "time" | "datetime" | "full" | "day";

function format(t: number, mode: Mode) {
  switch (mode) {
    case "date":
      return dateLabel(t);
    case "time":
      return timeLabel(t);
    case "datetime":
      return dateTimeLabel(t);
    case "full":
      return fullLabel(t);
    case "day":
      return new Date(t).toLocaleDateString(clientT().locale, { weekday: "long", day: "numeric", month: "long" });
    default:
      return relative(t);
  }
}

export function Time({ t, mode = "relative", className }: { t: number; mode?: Mode; className?: string }) {
  const [, tick] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    if (mode !== "relative") return;
    const id = setInterval(() => tick((x) => x + 1), 60_000);
    return () => clearInterval(id);
  }, [mode]);
  // the server doesn't know the reader's time zone: an ISO date until the browser takes over
  const text = mounted ? format(t, mode) : new Date(t).toISOString().slice(0, 10);
  return (
    <time dateTime={new Date(t).toISOString()} title={mounted ? fullLabel(t) : undefined} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
