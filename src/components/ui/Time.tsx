"use client";

import { useEffect, useState } from "react";

/** Dates in the reader's own time zone and words ("5 min ago"), formatted in the browser. */

export function relative(t: number, nowMs = Date.now()): string {
  const s = Math.round((nowMs - t) / 1000);
  const future = s < 0;
  const a = Math.abs(s);
  const fmt = (n: number, unit: string) => (future ? `in ${n} ${unit}` : `${n} ${unit} ago`);
  if (a < 45) return future ? "in a moment" : "just now";
  if (a < 3600) return fmt(Math.round(a / 60), "min");
  if (a < 86400) return fmt(Math.round(a / 3600), Math.round(a / 3600) === 1 ? "hour" : "hours");
  if (a < 7 * 86400) {
    const d = Math.round(a / 86400);
    if (d === 1) return future ? "tomorrow" : "yesterday";
    return fmt(d, "days");
  }
  return dateLabel(t);
}

export function dateLabel(t: number) {
  const d = new Date(t);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

export function timeLabel(t: number) {
  return new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function dateTimeLabel(t: number) {
  return new Date(t).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function fullLabel(t: number) {
  return new Date(t).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" });
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
      return new Date(t).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
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
