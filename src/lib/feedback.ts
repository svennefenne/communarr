import "server-only";
import { db, now } from "./db";
import { UserError } from "./errors";
import { notify } from "./notify";
import { summaries, type User } from "./users";
import type { UserSummary } from "./types";

/**
 * Feedback: anyone can tell the admins what they think (the user menu's "Send feedback"). It lands
 * in Admin → Feedback and in the admins' bell.
 */

export interface FeedbackView {
  id: number;
  author: UserSummary | null;
  body: string;
  /** the page they were on, if they included it */
  page: string;
  createdAt: number;
  done: boolean;
  doneBy: UserSummary | null;
}

export function sendFeedback(u: User, body: string, page: string) {
  const text = body.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);
  if (!text) throw new UserError("Write something first.");
  const recent = (db().prepare("select count(*) n from feedback where user_id = ? and created_at > ?").get(u.id, now() - 3600_000) as { n: number }).n;
  if (recent >= 10) throw new UserError("That's a lot of feedback in one go. Try again in a while.");
  const where = /^\/[\w\-./?=&%#]*$/.test(page) ? page.slice(0, 300) : "";
  db().prepare("insert into feedback (user_id, body, page, created_at) values (?, ?, ?, ?)").run(u.id, text, where, now());
  const admins = (db().prepare("select id from users where role = 'admin' and banned = 0 and id != ?").all(u.id) as { id: number }[]).map((r) => r.id);
  const excerpt = text.length > 140 ? `${text.slice(0, 139)}…` : text;
  notify(admins, { kind: "group", actorId: u.id, title: "{name} sent feedback", body: "{text}", vars: { name: u.name, text: excerpt }, url: "/admin#feedback" });
}

export function listFeedback(): FeedbackView[] {
  const rows = db().prepare("select * from feedback order by done_at is not null, created_at desc limit 200").all() as { id: number; user_id: number | null; body: string; page: string; created_at: number; done_at: number | null; done_by: number | null }[];
  const people = summaries(rows.flatMap((r) => [r.user_id, r.done_by]).filter((x): x is number => !!x));
  return rows.map((r) => ({
    id: r.id,
    author: r.user_id ? people.get(r.user_id) ?? null : null,
    body: r.body,
    page: r.page,
    createdAt: r.created_at,
    done: !!r.done_at,
    doneBy: r.done_by ? people.get(r.done_by) ?? null : null,
  }));
}

export const openFeedback = () => (db().prepare("select count(*) n from feedback where done_at is null").get() as { n: number }).n;

export function markFeedback(by: User, id: number, done: boolean) {
  db().prepare("update feedback set done_at = ?, done_by = ? where id = ?").run(done ? now() : null, done ? by.id : null, id);
}

export function deleteFeedback(id: number) {
  db().prepare("delete from feedback where id = ?").run(id);
}
