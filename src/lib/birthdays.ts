import "server-only";
import { db } from "./db";
import { notify } from "./notify";
import { getMeta, getSettings, setMeta } from "./settings";

/** Once a day, from 08:00 in the site's time zone: tell everyone whose birthday it is. */
export function birthdayPings() {
  const tz = getSettings().timezone;
  let parts: Record<string, string>;
  try {
    parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false, timeZone: tz })
        .formatToParts(new Date())
        .map((p) => [p.type, p.value]),
    );
  } catch {
    return;
  }
  if (Number(parts.hour) < 8) return;
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  if (getMeta("birthdays.sent") === today) return;
  setMeta("birthdays.sent", today);
  const people = db().prepare("select id, username, display_name from users where birthday = ? and banned = 0").all(`${parts.month}-${parts.day}`) as { id: number; username: string; display_name: string }[];
  if (!people.length) return;
  const everyone = (db().prepare("select id from users where banned = 0").all() as { id: number }[]).map((r) => r.id);
  for (const p of people) {
    notify(
      everyone.filter((id) => id !== p.id),
      { kind: "event", title: "🎂 It's {name}'s birthday today!", body: "Say happy birthday!", vars: { name: p.display_name }, url: `/u/${encodeURIComponent(p.username)}`, tag: `bday-${p.id}` },
    );
  }
}
