"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Cake, Globe, Mail, MapPin, Pencil, ShieldCheck, Smile } from "lucide-react";
import type { UserSummary } from "@/lib/types";
import { useApp, usePresence, useToast } from "@/components/app/AppProvider";
import { Avatar, ROLE_LABEL } from "@/components/ui/Avatar";
import { Time } from "@/components/ui/Time";
import { StatusDialog } from "@/components/shell/StatusDialog";
import { dmAction } from "@/app/actions/chat";

export interface ProfileView extends UserSummary {
  banner: string | null;
  pronouns: string;
  location: string;
  website: string;
  birthday: string | null;
  createdAt: number;
  lastSeen: number | null;
  stats: { posts: number; threads: number; replies: number; polls: number; events: number; messages: number };
}

export function ProfileHeader({ p }: { p: ProfileView }) {
  const { me, site } = useApp();
  const toast = useToast();
  const router = useRouter();
  const state = usePresence(p.id);
  const [status, setStatus] = useState(false);
  const mine = me?.id === p.id;
  const bday = p.birthday ? new Date(2000, Number(p.birthday.slice(0, 2)) - 1, Number(p.birthday.slice(3))).toLocaleDateString(undefined, { day: "numeric", month: "long" }) : null;
  return (
    <header className="panel profile-head" style={{ ["--gc" as string]: p.accent }}>
      <div className="group-banner" style={p.banner ? { backgroundImage: `url("${p.banner}")` } : undefined} />
      <div className="group-head-body">
        <span className="profile-avatar">
          <Avatar user={p} size={112} presence />
        </span>
        <div className="grow" style={{ minWidth: 0 }}>
          <span className="eyebrow row" style={{ gap: 8 }}>
            @{p.username}
            {ROLE_LABEL[p.role] ? (
              <span className="row" style={{ gap: 4 }}>
                <ShieldCheck size={13} /> {ROLE_LABEL[p.role]}
              </span>
            ) : null}
          </span>
          <h1 className="display page-title" style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)" }}>
            {p.name}
          </h1>
          <div className="row wrap small dim" style={{ gap: "4px 14px", marginTop: 6 }}>
            {p.pronouns ? <span>{p.pronouns}</span> : null}
            <span className={`presence-text ${state}`}>
              <i className={`presence ${state}`} />
              {state === "online" ? "Here now" : state === "away" ? "Away" : state === "busy" ? "Busy" : p.lastSeen ? <>Last seen <Time t={p.lastSeen} /></> : "Not seen yet"}
            </span>
            {p.location ? (
              <span className="row" style={{ gap: 4 }}>
                <MapPin size={13} /> {p.location}
              </span>
            ) : null}
            {p.website ? (
              <a href={p.website} target="_blank" rel="noopener noreferrer nofollow" className="row link" style={{ gap: 4 }}>
                <Globe size={13} /> {p.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            ) : null}
            {bday ? (
              <span className="row" style={{ gap: 4 }}>
                <Cake size={13} /> {bday}
              </span>
            ) : null}
            <span>
              Joined <Time t={p.createdAt} mode="date" />
            </span>
          </div>
          {p.statusText || p.statusEmoji ? (
            <div className="profile-status">
              {p.statusEmoji} {p.statusText}
            </div>
          ) : null}
        </div>
        <div className="group-actions">
          {mine ? (
            <>
              <button type="button" className="btn btn-sm" onClick={() => setStatus(true)}>
                <Smile size={15} /> Status
              </button>
              <Link href="/settings" className="btn btn-sm">
                <Pencil size={15} /> Edit profile
              </Link>
            </>
          ) : site.features.chat ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={async () => {
                const r = await dmAction(p.id);
                if (r.ok) router.push(`/chat/${r.data}`);
                else toast(r.error, { kind: "err" });
              }}
            >
              <Mail size={15} /> Message
            </button>
          ) : null}
          {me?.isAdmin && !mine ? (
            <Link href={`/admin?user=${p.id}#members`} className="btn btn-ghost btn-sm">
              <ShieldCheck size={15} /> Manage
            </Link>
          ) : null}
        </div>
      </div>
      <div className="profile-stats">
        {(
          [
            ["posts", "post", "posts"],
            ["threads", "thread", "threads"],
            ["replies", "reply", "replies"],
            ["polls", "poll", "polls"],
            ["events", "event", "events"],
            ["messages", "chat message", "chat messages"],
          ] as const
        ).map(([k, one, many]) => (
          <span key={k}>
            <b>{p.stats[k]}</b> {p.stats[k] === 1 ? one : many}
          </span>
        ))}
      </div>
      {status && me ? <StatusDialog me={me} onClose={() => setStatus(false)} /> : null}
    </header>
  );
}
