import "server-only";
import { db, now } from "./db";
import { notify } from "./notify";
import { cleanLine } from "./sanitize";
import { summaries, type User } from "./users";
import type { UserSummary } from "./types";

/** Members can flag something for the moderators (Admin → Reports). */

export type ReportTarget = "post" | "comment" | "thread" | "reply" | "poll" | "event" | "message" | "user" | "group";

export interface ReportView {
  id: number;
  type: ReportTarget;
  targetId: number;
  reason: string;
  status: "open" | "resolved" | "dismissed";
  reporter: UserSummary | null;
  resolvedBy: UserSummary | null;
  note: string;
  createdAt: number;
  resolvedAt: number | null;
  url: string;
  preview: string;
}

const URL: Record<ReportTarget, (id: number) => string> = {
  post: (id) => `/posts/${id}`,
  comment: (id) => `/go/comment/${id}`,
  thread: (id) => `/forum/t/${id}`,
  reply: (id) => `/go/reply/${id}`,
  poll: (id) => `/polls/${id}`,
  event: (id) => `/events/${id}`,
  message: (id) => `/go/message/${id}`,
  user: (id) => `/go/user/${id}`,
  group: (id) => `/go/group/${id}`,
};

function preview(type: ReportTarget, id: number): string {
  const q: Record<ReportTarget, string> = {
    post: "select coalesce(nullif(title, ''), body_text) t from posts where id = ?",
    comment: "select body_text t from comments where id = ?",
    thread: "select title t from forum_threads where id = ?",
    reply: "select body_text t from forum_posts where id = ?",
    poll: "select question t from polls where id = ?",
    event: "select title t from events where id = ?",
    message: "select body_text t from messages where id = ?",
    user: "select display_name t from users where id = ?",
    group: "select name t from groups where id = ?",
  };
  const r = db().prepare(q[type]).get(id) as { t: string } | undefined;
  return r ? r.t.slice(0, 200) : "(deleted)";
}

export function report(u: User, type: ReportTarget, id: number, reason: string) {
  if (!(type in URL)) throw new Error("Can't report that.");
  const why = cleanLine(reason, 500) || "No reason given";
  db().prepare("insert into reports (reporter_id, target_type, target_id, reason, created_at) values (?, ?, ?, ?, ?)").run(u.id, type, id, why, now());
  const mods = (db().prepare("select id from users where role in ('admin','moderator') and banned = 0").all() as { id: number }[]).map((r) => r.id);
  notify(mods, { kind: "group", actorId: u.id, title: `${u.name} reported something`, body: why, url: "/admin#reports" });
}

export function listReports(status: "open" | "all" = "open"): ReportView[] {
  const rows = db()
    .prepare(`select * from reports ${status === "open" ? "where status = 'open'" : ""} order by created_at desc limit 200`)
    .all() as { id: number; reporter_id: number | null; target_type: ReportTarget; target_id: number; reason: string; status: ReportView["status"]; resolved_by: number | null; resolved_at: number | null; note: string; created_at: number }[];
  const people = summaries(rows.flatMap((r) => [r.reporter_id!, r.resolved_by!]).filter(Boolean));
  return rows.map((r) => ({
    id: r.id,
    type: r.target_type,
    targetId: r.target_id,
    reason: r.reason,
    status: r.status,
    reporter: r.reporter_id ? people.get(r.reporter_id) ?? null : null,
    resolvedBy: r.resolved_by ? people.get(r.resolved_by) ?? null : null,
    note: r.note,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    url: URL[r.target_type](r.target_id),
    preview: preview(r.target_type, r.target_id),
  }));
}

export function resolveReport(u: User, id: number, status: "resolved" | "dismissed", note = "") {
  db().prepare("update reports set status = ?, resolved_by = ?, resolved_at = ?, note = ? where id = ?").run(status, u.id, now(), cleanLine(note, 300), id);
}

export function openReportCount(): number {
  return (db().prepare("select count(*) n from reports where status = 'open'").get() as { n: number }).n;
}
