"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Hash, Headphones, Lock, MessageCircle, MessagesSquare, UsersRound, Vote } from "lucide-react";
import type { EventView, PollView, PostView, ThreadCard } from "@/lib/contentTypes";
import type { RoomInfo } from "@/lib/chatTypes";
import type { UserSummary } from "@/lib/types";
import { useApp } from "@/components/app/AppProvider";
import { useVoice } from "@/components/voice/VoiceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Time } from "@/components/ui/Time";
import { DateTile, EventWhen } from "@/components/feed/EventCard";

function Widget({ title, icon, href, more = "See all", children }: { title: string; icon: React.ReactNode; href?: string; more?: string; children: React.ReactNode }) {
  return (
    <section className="panel widget">
      <div className="panel-head">
        <span className="eyebrow row" style={{ gap: 7 }}>
          {icon} {title}
        </span>
        {href ? (
          <Link href={href} className="small muted row widget-more" style={{ gap: 4 }}>
            {more} <ArrowRight size={13} />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function Greeting({ name }: { name: string }) {
  const [hi, setHi] = useState("Hi");
  const [day, setDay] = useState("");
  useEffect(() => {
    const h = new Date().getHours();
    setHi(h < 5 ? "Up late" : h < 10 ? "Good morning" : h < 17 ? "Hi" : h < 22 ? "Good evening" : "Good night");
    setDay(new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }));
  }, []);
  return (
    <div>
      <span className="eyebrow" suppressHydrationWarning>
        Front page {day ? `· ${day}` : ""}
      </span>
      <h1 className="display page-title" suppressHydrationWarning>
        {hi}, {name.split(" ")[0]}
      </h1>
    </div>
  );
}

export function NewsHero({ post }: { post: PostView }) {
  return (
    <Link href={`/posts/${post.id}`} className="panel news-hero hoverable stripe-top">
      {post.cover ? <span className="news-hero-pic" style={{ backgroundImage: `url("${post.cover}")` }} /> : null}
      <span className="news-hero-text">
        <span className="eyebrow">
          {post.pinned ? "Pinned news" : "Latest news"} · <Time t={post.createdAt} />
        </span>
        <span className="display news-hero-title">{post.title}</span>
        <span className="small dim clamp-2">{post.html.replace(/<\/(p|h\d|li)>/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 200)}</span>
        <span className="row small" style={{ gap: 8, marginTop: 4 }}>
          <Avatar user={post.author} size={22} /> {post.author.name}
        </span>
      </span>
    </Link>
  );
}

export function UpcomingWidget({ events }: { events: EventView[] }) {
  return (
    <Widget title="Coming up" icon={<CalendarDays size={14} />} href="/calendar" more="Calendar">
      {events.length ? (
        <div className="list">
          {events.map((e) => (
            <Link key={`${e.id}-${e.startAt}`} href={`/events/${e.id}`} className="list-row upcoming-row">
              <DateTile t={e.startAt} color={e.color} small />
              <span className="grow" style={{ minWidth: 0 }}>
                <b className="ellipsis" style={{ display: "block" }}>
                  {e.title}
                </b>
                <span className="tiny muted ellipsis" style={{ display: "block" }}>
                  <EventWhen e={e} />
                </span>
              </span>
              {e.mine === "going" ? <span className="badge accent">Going</span> : e.mine === "maybe" ? <span className="badge">Maybe</span> : <span className="tiny muted">{e.going.length} going</span>}
            </Link>
          ))}
        </div>
      ) : (
        <div className="panel-body small muted">
          Nothing planned.{" "}
          <Link href="/events/new" className="link">
            Plan something
          </Link>
        </div>
      )}
    </Widget>
  );
}

export function ChatWidget({ rooms }: { rooms: RoomInfo[] }) {
  const { counts } = useApp();
  const voice = useVoice();
  return (
    <Widget title="Chat" icon={<MessageCircle size={14} />} href="/chat" more="Open chat">
      {rooms.length ? (
        <div className="list">
          {rooms.map((r) => {
            const unread = counts.rooms[r.id] ?? 0;
            const talking = voice.channels[r.id]?.length ?? 0;
            return (
              <Link key={r.id} href={`/chat/${r.id}`} className={`list-row ${unread ? "unread" : ""}`}>
                {r.kind === "dm" && r.other ? <Avatar user={r.other} size={30} presence /> : <span className="room-icon">{r.emoji || (r.visibility === "private" ? <Lock size={14} /> : <Hash size={15} />)}</span>}
                <span className="grow" style={{ minWidth: 0 }}>
                  <b className="ellipsis" style={{ display: "block" }}>
                    {r.name}
                  </b>
                  <span className="tiny muted ellipsis" style={{ display: "block" }}>
                    {r.lastMessage ? `${r.lastMessage.author ? r.lastMessage.author + ": " : ""}${r.lastMessage.text}` : r.topic}
                  </span>
                </span>
                {talking ? (
                  <span className="badge teal" title={`${talking} in voice`}>
                    <Headphones size={11} /> {talking}
                  </span>
                ) : null}
                {unread ? <span className="count-badge" style={{ position: "static", boxShadow: "none" }}>{unread}</span> : null}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="panel-body small muted">No chats yet.</div>
      )}
    </Widget>
  );
}

export function OnlineWidget({ members }: { members: UserSummary[] }) {
  const { presence } = useApp();
  const online = members.filter((m) => presence.has(m.id));
  return (
    <Widget title={`Here now · ${online.length}`} icon={<span className="dot" style={{ background: "var(--ok)" }} />} href="/members" more="Everyone">
      <div className="panel-body">
        {online.length ? (
          <div className="online-grid">
            {online.map((m) => (
              <Link key={m.id} href={`/u/${encodeURIComponent(m.username)}`} className="online-person" title={`${m.name}${m.statusText ? ` · ${m.statusEmoji} ${m.statusText}` : ""}`}>
                <Avatar user={m} size={40} presence />
                <span className="tiny ellipsis">{m.name.split(" ")[0]}</span>
              </Link>
            ))}
          </div>
        ) : (
          <span className="small muted">Nobody else right now.</span>
        )}
      </div>
    </Widget>
  );
}

export function PollsWidget({ polls }: { polls: PollView[] }) {
  if (!polls.length) return null;
  return (
    <Widget title="Waiting for your vote" icon={<Vote size={14} />} href="/polls">
      <div className="list">
        {polls.map((p) => (
          <Link key={p.id} href={`/polls/${p.id}`} className="list-row">
            <span className="grow" style={{ minWidth: 0 }}>
              <b className="clamp-2">{p.question}</b>
              <span className="tiny muted">
                {p.totalVoters} voted{p.closesAt ? <> · closes <Time t={p.closesAt} /></> : null}
              </span>
            </span>
            <ArrowRight size={15} className="muted" />
          </Link>
        ))}
      </div>
    </Widget>
  );
}

export function ForumWidget({ threads }: { threads: ThreadCard[] }) {
  return (
    <Widget title="In the forum" icon={<MessagesSquare size={14} />} href="/forum">
      {threads.length ? (
        <div className="list">
          {threads.map((t) => (
            <Link key={t.id} href={`/forum/t/${t.id}`} className={`list-row ${t.unread ? "unread" : ""}`}>
              <span className="cat-dot" style={{ background: t.category.color }} />
              <span className="grow" style={{ minWidth: 0 }}>
                <b className="ellipsis" style={{ display: "block" }}>
                  {t.title}
                </b>
                <span className="tiny muted">
                  {t.replies} {t.replies === 1 ? "reply" : "replies"} · <Time t={t.lastPostAt} />
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="panel-body small muted">
          Quiet so far.{" "}
          <Link href="/forum/new" className="link">
            Start a thread
          </Link>
        </div>
      )}
    </Widget>
  );
}

export function GroupsWidget({ groups }: { groups: { id: number; slug: string; name: string; color: string; avatar: string | null; memberCount: number }[] }) {
  return (
    <Widget title="Your groups" icon={<UsersRound size={14} />} href="/groups">
      {groups.length ? (
        <div className="list">
          {groups.map((g) => (
            <Link key={g.id} href={`/groups/${g.slug}`} className="list-row">
              <span className="group-avatar" style={{ ["--gc" as string]: g.color, backgroundImage: g.avatar ? `url("${g.avatar}")` : undefined }}>
                {g.avatar ? "" : g.name.slice(0, 1)}
              </span>
              <b className="grow ellipsis">{g.name}</b>
              <span className="tiny muted">{g.memberCount}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="panel-body small muted">
          You&apos;re not in any groups.{" "}
          <Link href="/groups" className="link">
            Find one
          </Link>
        </div>
      )}
    </Widget>
  );
}

/** Phones: what's coming up and who's here, in a strip that scrolls sideways. */
export function MobileStrip({ events, members }: { events: EventView[]; members: UserSummary[] }) {
  const { presence } = useApp();
  const online = members.filter((m) => presence.has(m.id));
  if (!events.length && !online.length) return null;
  return (
    <div className="mobile-strip">
      {online.length ? (
        <div className="strip-online">
          {online.map((m) => (
            <Link key={m.id} href={`/u/${encodeURIComponent(m.username)}`} className="online-person">
              <Avatar user={m} size={44} presence />
              <span className="tiny ellipsis">{m.name.split(" ")[0]}</span>
            </Link>
          ))}
        </div>
      ) : null}
      {events.length ? (
        <div className="strip-events">
          {events.map((e) => (
            <Link key={`${e.id}-${e.startAt}`} href={`/events/${e.id}`} className="panel strip-event">
              <DateTile t={e.startAt} color={e.color} small />
              <span style={{ minWidth: 0 }}>
                <b className="ellipsis" style={{ display: "block" }}>
                  {e.title}
                </b>
                <span className="tiny muted">
                  <Time t={e.startAt} mode={e.allDay ? "date" : "datetime"} />
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
