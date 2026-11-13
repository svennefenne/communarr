import { daysIntoWeek, type Clock } from "./clock";

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** A month's weeks (in the site's: its first day of the week): from the week its first day is in, through the week its last day is in. */
export function monthGrid(month: Date, c?: Pick<Clock, "weekStart">): { from: Date; to: Date; weeks: Date[][] } {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const from = addDays(first, -daysIntoWeek(first.getDay(), c));
  const weeks: Date[][] = [];
  for (let d = from; d < next; d = addDays(d, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  return { from, to: addDays(from, weeks.length * 7), weeks };
}

/** "2026-11" */
export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
