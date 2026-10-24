"use client";

import { useT } from "@/components/app/AppProvider";
import { clock, weekDays } from "@/lib/clock";
import { capital, describeRepeat, NTH_ON, weekdayName, weekOfMonth, type RepeatFreq, type RepeatRule } from "@/lib/repeat";

export type RepeatEnds = "never" | "on" | "after";

const UNITS: Record<RepeatFreq, [string, string]> = { daily: ["day", "days"], weekly: ["week", "weeks"], monthly: ["month", "months"], yearly: ["year", "years"] };

/**
 * The event form's custom repeat: every n days, weeks, months or years; for weeks, the days (in the
 * site's week order); for months, the same date or the same weekday; and how it ends. The words
 * underneath say what it adds up to.
 */
export function CustomRepeat({
  rule,
  onRule,
  start,
  ends,
  onEnds,
  until,
  onUntil,
  minDate,
}: {
  rule: RepeatRule;
  onRule: (r: RepeatRule) => void;
  /** when the event starts (the weekday and date the rule follows) */
  start: Date;
  ends: RepeatEnds;
  onEnds: (e: RepeatEnds) => void;
  until: string;
  onUntil: (v: string) => void;
  minDate: string;
}) {
  const t = useT();
  const valid = !Number.isNaN(start.getTime());
  const days = rule.days?.length ? rule.days : valid ? [start.getDay()] : [];
  const toggleDay = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
    // at least one day
    if (next.length) onRule({ ...rule, days: next.sort() });
  };
  const summary = valid ? describeRepeat(t, { repeat: "custom", repeatRule: { ...rule, days, count: ends === "after" ? rule.count ?? 1 : null }, startAt: start.getTime() }, clock().weekStart) : "";
  return (
    <div className="custom-repeat stack tight">
      <div className="row wrap custom-repeat-line">
        <span className="small">{t("Repeats every")}</span>
        <input
          type="number"
          className="input sm"
          min={1}
          max={99}
          value={rule.interval}
          onChange={(e) => onRule({ ...rule, interval: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })}
          aria-label={t("How many")}
          style={{ width: 72 }}
        />
        <select className="select sm" value={rule.freq} onChange={(e) => onRule({ ...rule, freq: e.target.value as RepeatFreq })} aria-label={t("Days, weeks, months or years")} style={{ width: "auto" }}>
          {(Object.keys(UNITS) as RepeatFreq[]).map((f) => (
            <option key={f} value={f}>
              {t.n(rule.interval, UNITS[f][0], UNITS[f][1])}
            </option>
          ))}
        </select>
      </div>
      {rule.freq === "weekly" ? (
        <div className="row wrap custom-repeat-line">
          <span className="small">{t("On")}</span>
          <div className="pills" role="group" aria-label={t("Which days")}>
            {weekDays().map((d) => (
              <button key={d} type="button" className={`pill ${days.includes(d) ? "active" : ""}`} aria-pressed={days.includes(d)} onClick={() => toggleDay(d)}>
                {weekdayName(d, t.locale)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {rule.freq === "monthly" && valid ? (
        <div className="pills" role="group" aria-label={t("Which day of the month")}>
          <button type="button" className={`pill ${rule.monthly !== "weekday" ? "active" : ""}`} onClick={() => onRule({ ...rule, monthly: "date" })}>
            {capital(t("on day {n}", { n: start.getDate() }))}
          </button>
          <button type="button" className={`pill ${rule.monthly === "weekday" ? "active" : ""}`} onClick={() => onRule({ ...rule, monthly: "weekday" })}>
            {capital(t(NTH_ON[weekOfMonth(start)], { weekday: weekdayName(start.getDay(), t.locale, "long") }))}
          </button>
        </div>
      ) : null}
      <div className="row wrap custom-repeat-line">
        <span className="small">{t("Ends")}</span>
        <div className="pills" role="group" aria-label={t("Ends")}>
          <button type="button" className={`pill ${ends === "never" ? "active" : ""}`} onClick={() => onEnds("never")}>
            {t("Never")}
          </button>
          <button type="button" className={`pill ${ends === "on" ? "active" : ""}`} onClick={() => onEnds("on")}>
            {t("On a date")}
          </button>
          <button type="button" className={`pill ${ends === "after" ? "active" : ""}`} onClick={() => onEnds("after")}>
            {t("After")}
          </button>
        </div>
        {ends === "on" ? <input type="date" className="input sm" value={until} min={minDate} onChange={(e) => onUntil(e.target.value)} aria-label={t("The last day")} style={{ width: "auto" }} /> : null}
        {ends === "after" ? (
          <span className="row" style={{ gap: 6 }}>
            <input
              type="number"
              className="input sm"
              min={1}
              max={999}
              value={rule.count ?? 1}
              onChange={(e) => onRule({ ...rule, count: Math.min(999, Math.max(1, Number(e.target.value) || 1)) })}
              aria-label={t("How many times")}
              style={{ width: 80 }}
            />
            <span className="small">{t.n(rule.count ?? 1, "time", "times")}</span>
          </span>
        ) : null}
      </div>
      {summary ? <p className="small muted custom-repeat-sum">{summary}</p> : null}
    </div>
  );
}
