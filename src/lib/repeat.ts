import type { T } from "./i18n";

/**
 * Repeating events. The simple ones (every day, week, month, year) are just a word; a custom repeat
 * is a rule: every n days, weeks, months or years; for weeks, on which days; for months, the same
 * date (the 6th) or the same weekday (the first Friday); and how it ends: never, on a date (the
 * event's repeat_until), or after so many times. Stepped in local time, so 18:00 stays 18:00 across
 * summer time. Shared by the server (the calendar, reminders, .ics) and the event form.
 */

export type RepeatFreq = "daily" | "weekly" | "monthly" | "yearly";
export type Repeat = "none" | RepeatFreq | "custom";

export interface RepeatRule {
  freq: RepeatFreq;
  /** every n days, weeks, months or years (1–99) */
  interval: number;
  /** weekly: the days (0 Sunday … 6 Saturday); none given: the day it starts on */
  days?: number[];
  /** monthly: the same date ("date"), or the same weekday of the month ("weekday": the first Friday; the 5th means the last) */
  monthly?: "date" | "weekday";
  /** ends after this many times (none: never, or on a date) */
  count?: number | null;
}

const FREQS: RepeatFreq[] = ["daily", "weekly", "monthly", "yearly"];

/** A rule from the outside (a form), checked; null when it isn't one. */
export function cleanRule(x: unknown): RepeatRule | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>;
  if (!FREQS.includes(r.freq as RepeatFreq)) return null;
  const interval = Math.min(99, Math.max(1, Math.round(Number(r.interval) || 1)));
  const days = Array.isArray(r.days) ? [...new Set(r.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [];
  const count = r.count == null || r.count === "" ? null : Math.min(999, Math.max(1, Math.round(Number(r.count) || 1)));
  return {
    freq: r.freq as RepeatFreq,
    interval,
    ...(r.freq === "weekly" && days.length ? { days } : {}),
    ...(r.freq === "monthly" ? { monthly: r.monthly === "weekday" ? ("weekday" as const) : ("date" as const) } : {}),
    count,
  };
}

/** Which of its weekday in the month a date is: 1–4, or 5 for the last. */
const weekOfMonth = (d: Date) => {
  const n = Math.ceil(d.getDate() / 7);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() + 7 > last ? 5 : n;
};

/** The nth weekday (5: the last) of a month, at a time of day; null if there's none. */
function nthWeekday(year: number, month: number, weekday: number, n: number, h: number, m: number, s: number): Date | null {
  if (n === 5) {
    const d = new Date(year, month + 1, 0, h, m, s);
    d.setDate(d.getDate() - ((d.getDay() - weekday + 7) % 7));
    return d;
  }
  // (month may run past December: the date works out the year)
  const d = new Date(year, month, 1, h, m, s);
  const inMonth = d.getMonth();
  d.setDate(1 + ((weekday - d.getDay() + 7) % 7) + (n - 1) * 7);
  return d.getMonth() === inMonth ? d : null;
}

/**
 * The starts of a custom repeat's times between from and to (each lasting len), in order. The times
 * before `from` count too, for a rule that ends after so many. weekStart: where a week begins, for
 * "every 2 weeks".
 */
export function ruleOccurrences(start: number, len: number, rule: RepeatRule, until: number | null, from: number, to: number, max = 400, weekStart = 1): number[] {
  const out: number[] = [];
  const s = new Date(start);
  const [h, m, sec] = [s.getHours(), s.getMinutes(), s.getSeconds()];
  const end = until ?? Infinity;
  let n = 0;
  // false: stop
  const take = (t: number): boolean => {
    if (t < start) return true;
    if (t >= to || t > end || (rule.count && n >= rule.count) || out.length >= max) return false;
    n++;
    if (t + len > from) out.push(t);
    return true;
  };
  const step = rule.interval;
  if (rule.freq === "daily") {
    for (let i = 0; i < 20000; i++) if (!take(new Date(s.getFullYear(), s.getMonth(), s.getDate() + i * step, h, m, sec).getTime())) break;
  } else if (rule.freq === "weekly") {
    const days = rule.days?.length ? rule.days : [s.getDay()];
    // the days in the order of the week, from the week the event starts in
    const order = [...days].sort((a, b) => ((a - weekStart + 7) % 7) - ((b - weekStart + 7) % 7));
    const first = new Date(s.getFullYear(), s.getMonth(), s.getDate() - ((s.getDay() - weekStart + 7) % 7), h, m, sec);
    outer: for (let w = 0; w < 5000; w++) {
      for (const d of order) {
        const t = new Date(first.getFullYear(), first.getMonth(), first.getDate() + w * 7 * step + ((d - weekStart + 7) % 7), h, m, sec).getTime();
        if (!take(t)) break outer;
      }
    }
  } else if (rule.freq === "monthly") {
    const nth = weekOfMonth(s);
    for (let i = 0; i < 5000; i++) {
      const y = s.getFullYear();
      const mo = s.getMonth() + i * step;
      let d: Date | null;
      if (rule.monthly === "weekday") d = nthWeekday(y, mo, s.getDay(), nth, h, m, sec);
      else {
        // the same date; a month without it (the 31st) is skipped
        d = new Date(y, mo, s.getDate(), h, m, sec);
        if (d.getDate() !== s.getDate()) d = null;
      }
      if (d && !take(d.getTime())) break;
      if (new Date(y, mo, 1).getTime() >= to) break;
    }
  } else {
    for (let i = 0; i < 2000; i++) {
      const d = new Date(s.getFullYear() + i * step, s.getMonth(), s.getDate(), h, m, sec);
      // (the 29th of February: only in leap years)
      if (d.getMonth() !== s.getMonth()) continue;
      if (!take(d.getTime())) break;
    }
  }
  return out;
}

const ICS_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** The RRULE line for calendar apps (until: already written as an .ics time). */
export function rrule(rule: RepeatRule, start: number, until: string | null): string {
  const parts = [`FREQ=${rule.freq.toUpperCase()}`];
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.freq === "weekly" && rule.days?.length) parts.push(`BYDAY=${rule.days.map((d) => ICS_DAYS[d]).join(",")}`);
  if (rule.freq === "monthly" && rule.monthly === "weekday") {
    const s = new Date(start);
    const n = weekOfMonth(s);
    parts.push(`BYDAY=${n === 5 ? -1 : n}${ICS_DAYS[s.getDay()]}`);
  }
  if (rule.count) parts.push(`COUNT=${rule.count}`);
  else if (until) parts.push(`UNTIL=${until}`);
  return `RRULE:${parts.join(";")}`;
}

/** English, translate where shown: the simple repeats' names. */
export const REPEAT_LABEL: Record<Repeat, string> = { none: "", daily: "Every day", weekly: "Every week", monthly: "Every month", yearly: "Every year", custom: "" };

/** The weekday of the month, by which one it is (1–4, 5 the last): English, translated with t() and {weekday}. */
export const NTH_ON = ["", "on the first {weekday}", "on the second {weekday}", "on the third {weekday}", "on the fourth {weekday}", "on the last {weekday}"];

/** The first letter up ("on day 6" as a button: "On day 6"). */
export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The name of a weekday (0 Sunday … 6 Saturday) in a language. */
export const weekdayName = (day: number, locale: string | undefined, style: "short" | "long" = "short") => new Date(2024, 0, 7 + day).toLocaleDateString(locale, { weekday: style });

/** How an event repeats, in words: "Every 2 weeks on Mon, Wed · 10 times" (until a date: shown beside it). */
export function describeRepeat(t: T, e: { repeat: Repeat; repeatRule: RepeatRule | null; startAt: number }, weekStart = 1): string {
  if (e.repeat !== "custom" || !e.repeatRule) return e.repeat === "none" ? "" : t(REPEAT_LABEL[e.repeat]);
  const r = e.repeatRule;
  const UNITS: Record<RepeatFreq, [string, string]> = { daily: ["day", "days"], weekly: ["week", "weeks"], monthly: ["month", "months"], yearly: ["year", "years"] };
  const parts = [r.interval === 1 ? t(REPEAT_LABEL[r.freq]) : t("Every {n} {units}", { n: r.interval, units: t(UNITS[r.freq][1]) })];
  if (r.freq === "weekly" && r.days?.length) {
    const days = [...r.days].sort((a, b) => ((a - weekStart + 7) % 7) - ((b - weekStart + 7) % 7));
    parts.push(t("on {days}", { days: days.map((d) => weekdayName(d, t.locale)).join(", ") }));
  }
  if (r.freq === "monthly") {
    const s = new Date(e.startAt);
    parts.push(r.monthly === "weekday" ? t(NTH_ON[weekOfMonth(s)], { weekday: weekdayName(s.getDay(), t.locale, "long") }) : t("on day {n}", { n: s.getDate() }));
  }
  const text = parts.join(" ");
  return r.count ? `${text} · ${t.n(r.count, "{n} time", "{n} times")}` : text;
}

/** The weekday of the month a date falls on, for the form ("the first Friday"). */
export { weekOfMonth };
