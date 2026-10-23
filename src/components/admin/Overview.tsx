"use client";

import { useState } from "react";
import { Bell, CalendarDays, Database, Flag, Mail, MessageCircle, FileText, UserCheck, Users, UsersRound } from "lucide-react";
import { useT } from "@/components/app/AppProvider";

export interface OverviewData {
  members: number;
  online: number;
  pending: number;
  reports: number;
  postsWeek: number;
  messagesWeek: number;
  upcoming: number;
  openPolls: number;
  groups: number;
  rooms: number;
  devices: number;
  invites: number;
  dbBytes: number;
  uploadBytes: number;
}

export interface DayActivity {
  day: string;
  posts: number;
  forum: number;
  messages: number;
  comments: number;
}

export const bytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(0)} KB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024 ** 3).toFixed(2)} GB`);

function Tile({ icon, label, value, sub, href, alert }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; href: string; alert?: boolean }) {
  return (
    <a href={href} className={`panel stat-tile hoverable ${alert ? "alert" : ""}`}>
      <span className="stat-icon-wrap">{icon}</span>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub ? <span className="tiny muted">{sub}</span> : null}
    </a>
  );
}

/** Activity per day: one bar per day (everything people wrote), the parts in its tooltip. */
function ActivityChart({ days }: { days: DayActivity[] }) {
  const t = useT();
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const totals = days.map((d) => d.posts + d.forum + d.messages + d.comments);
  const max = Math.max(4, ...totals);
  // a tidy top for the scale: 4 steps
  const step = Math.ceil(max / 4 / 5) * 5 || 1;
  const top = step * 4;
  const W = 600;
  const H = 160;
  const pad = { l: 30, r: 6, t: 8, b: 22 };
  const bw = (W - pad.l - pad.r) / days.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / top);
  const label = (d: string) => new Date(`${d}T12:00`).toLocaleDateString(t.locale, { day: "numeric", month: "short" });
  const h = hover != null ? days[hover] : null;
  return (
    <div className="panel panel-pad activity">
      <div className="row between wrap">
        <div>
          <b>{t("Activity, last 30 days")}</b>
          <div className="tiny muted">{t("Posts, forum posts, chat messages and comments per day")}</div>
        </div>
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => setTable((v) => !v)}>
          {table ? t("Show the chart") : t("Show as a table")}
        </button>
      </div>
      {table ? (
        <div className="activity-table">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t("Day")}</th>
                <th>{t("Posts")}</th>
                <th>{t("Forum")}</th>
                <th>{t("Chat")}</th>
                <th>{t("Comments")}</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.day}>
                  <td>{label(d.day)}</td>
                  <td>{d.posts}</td>
                  <td>{d.forum}</td>
                  <td>{d.messages}</td>
                  <td>{d.comments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="activity-plot" onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={t("Activity per day for the last 30 days")}>
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={i}>
                <line x1={pad.l} x2={W - pad.r} y1={y(i * step)} y2={y(i * step)} className="grid" />
                <text x={pad.l - 6} y={y(i * step) + 3} className="tick" textAnchor="end">
                  {i * step}
                </text>
              </g>
            ))}
            {days.map((d, i) => {
              const v = totals[i];
              const x = pad.l + i * bw + 1;
              const w = Math.max(2, bw - 2);
              const yy = y(v);
              const r = Math.min(4, w / 2, (H - pad.b - yy) / 2);
              return (
                <g key={d.day}>
                  {v ? <path d={`M${x},${H - pad.b} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + w - r} Q${x + w},${yy} ${x + w},${yy + r} V${H - pad.b} Z`} className={`bar ${hover === i ? "on" : ""}`} /> : null}
                  {/* the hit target is the whole column */}
                  <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
                  {(i % 7 === 0 && days.length - 1 - i >= 4) || i === days.length - 1 ? (
                    <text x={x + w / 2} y={H - 6} className="tick" textAnchor="middle">
                      {label(d.day)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
          {h && hover != null ? (
            <div className="chart-tip" style={{ left: `${((pad.l + (hover + 0.5) * bw) / W) * 100}%` }}>
              <b>{label(h.day)}</b>
              <span>{t("{n} in all", { n: totals[hover] })}</span>
              <span className="muted">
                {t("{posts} posts · {forum} forum · {chat} chat · {comments} comments", { posts: h.posts, forum: h.forum, chat: h.messages, comments: h.comments })}
              </span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function Overview({ o, days, isAdmin }: { o: OverviewData; days: DayActivity[]; isAdmin: boolean }) {
  const t = useT();
  return (
    <div className="stack">
      <div className="stat-grid">
        <Tile icon={<Users size={18} />} label={t("Members")} value={o.members} sub={t("{n} here now", { n: o.online })} href="#members" />
        <Tile icon={<UserCheck size={18} />} label={t("Waiting to get in")} value={o.pending} href="#members" alert={o.pending > 0} />
        <Tile icon={<Flag size={18} />} label={t("Open reports")} value={o.reports} href="#reports" alert={o.reports > 0} />
        <Tile icon={<FileText size={18} />} label={t("Posts this week")} value={o.postsWeek} sub={t("posts, threads and replies")} href="#content" />
        <Tile icon={<MessageCircle size={18} />} label={t("Chat this week")} value={o.messagesWeek} sub={t.n(o.rooms, "{n} room", "{n} rooms")} href="#rooms" />
        <Tile icon={<CalendarDays size={18} />} label={t("Coming up")} value={o.upcoming} sub={t.n(o.openPolls, "{n} open poll", "{n} open polls")} href="/calendar" />
        {isAdmin ? <Tile icon={<Mail size={18} />} label={t("Invite links")} value={o.invites} sub={t("that still work")} href="#invites" /> : null}
        {isAdmin ? <Tile icon={<Bell size={18} />} label={t("Push devices")} value={o.devices} href="#notifications" /> : null}
        {isAdmin ? <Tile icon={<Database size={18} />} label={t("Storage")} value={bytes(o.dbBytes + o.uploadBytes)} sub={t("{size} pictures", { size: bytes(o.uploadBytes) })} href="#system" /> : null}
        <Tile icon={<UsersRound size={18} />} label={t("Groups")} value={o.groups} href="#rooms" />
      </div>
      <ActivityChart days={days} />
    </div>
  );
}
