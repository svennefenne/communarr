/**
 * The site's clock (Admin → Name & texts): 24-hour or 12-hour times whatever the language, and the day
 * weeks start on (the calendar, repeat days). In the browser it's set once from the site's settings
 * (AppProvider); on the server, pass the settings in.
 */

export type TimeFormat = "24h" | "12h";
/** 1: Monday, 0: Sunday, 6: Saturday (as Date.getDay() counts) */
export type WeekStart = 1 | 0 | 6;

export interface Clock {
  timeFormat: TimeFormat;
  weekStart: WeekStart;
}

export const DEFAULT_CLOCK: Clock = { timeFormat: "24h", weekStart: 1 };

let current: Clock = DEFAULT_CLOCK;

export function setClock(c: Clock) {
  current = c;
}

export const clock = () => current;

/** For Intl / toLocale…String with timeStyle: 19:00 or 7:00 PM, whatever the language says. */
export const hourCycle = (c: Pick<Clock, "timeFormat"> = current) => ({ hourCycle: c.timeFormat === "12h" ? ("h12" as const) : ("h23" as const) });

/** For Intl with an hour of its own: 09:30 on a 24-hour clock, 9:30 PM on a 12-hour one. */
export const clockHour = (c: Pick<Clock, "timeFormat"> = current) => ({ hour: c.timeFormat === "12h" ? ("numeric" as const) : ("2-digit" as const), ...hourCycle(c) });

/** The days of the week from the first (0 Sunday … 6 Saturday). */
export const weekDays = (c: Pick<Clock, "weekStart"> = current) => Array.from({ length: 7 }, (_, i) => (c.weekStart + i) % 7);

/** How many days back to the start of the week from a day (0 Sunday … 6 Saturday). */
export const daysIntoWeek = (day: number, c: Pick<Clock, "weekStart"> = current) => (day - c.weekStart + 7) % 7;
