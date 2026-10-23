"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AtSign, Bell, CalendarDays, CheckCheck, Heart, Mail, Megaphone, MessageCircle, MessagesSquare, UsersRound, Vote } from "lucide-react";
import { useApp, useLive } from "@/components/app/AppProvider";
import { useDropdown } from "@/components/ui/ui";
import { Avatar } from "@/components/ui/Avatar";
import { Time } from "@/components/ui/Time";
import type { NotificationItem } from "@/lib/types";
import { listNotificationsAction, markReadAction } from "@/app/actions/notifications";

export const KIND_ICON: Record<string, React.ComponentType<{ size?: number }>> = {
  mention: AtSign,
  dm: Mail,
  room: MessageCircle,
  reply: MessagesSquare,
  forum: MessagesSquare,
  invite: Mail,
  event: CalendarDays,
  news: Megaphone,
  poll: Vote,
  group: UsersRound,
  reaction: Heart,
};

export function NotificationRow({ n, onOpen }: { n: NotificationItem; onOpen?: () => void }) {
  const Icon = KIND_ICON[n.kind] || Bell;
  return (
    <Link href={n.url} className={`list-row notif-row ${n.read ? "" : "unread"}`} onClick={onOpen}>
      <span className="notif-pic">
        {n.actor ? <Avatar user={n.actor} size={36} /> : <span className="avatar" style={{ width: 36, height: 36 }} />}
        <span className="notif-kind">
          <Icon size={12} />
        </span>
      </span>
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="notif-title clamp-2">{n.title}</span>
        {n.body ? <span className="notif-body clamp-2">{n.body}</span> : null}
        <span className="tiny faint">
          <Time t={n.createdAt} />
        </span>
      </span>
      {!n.read ? <span className="dot" aria-label="Unread" /> : null}
    </Link>
  );
}

export function NotificationBell() {
  const { counts } = useApp();
  const router = useRouter();
  const { open, setOpen, ref } = useDropdown();
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  useEffect(() => {
    if (open) listNotificationsAction().then(setItems);
  }, [open]);
  useLive("notify", (d) => {
    const { item } = d as { item: NotificationItem };
    setItems((list) => (list ? [item, ...list] : list));
  });

  const click = () => {
    // phones: the whole page instead of a dropdown
    if (window.matchMedia("(max-width: 699px)").matches) router.push("/notifications");
    else setOpen(!open);
  };
  const readAll = async () => {
    await markReadAction("all");
    setItems((l) => l?.map((n) => ({ ...n, read: true })) ?? l);
  };

  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="icon-btn" onClick={click} aria-label={`Notifications${counts.notifications ? ` (${counts.notifications} new)` : ""}`} aria-expanded={open}>
        <Bell size={20} />
        {counts.notifications ? <span className="count-badge">{counts.notifications > 99 ? "99+" : counts.notifications}</span> : null}
      </button>
      {open ? (
        <div className="panel menu down right notif-menu" role="dialog" aria-label="Notifications">
          <div className="row between" style={{ padding: "8px 10px 6px 12px" }}>
            <span className="eyebrow">Notifications</span>
            <button type="button" className="btn btn-ghost btn-xs" onClick={readAll} disabled={!counts.notifications}>
              <CheckCheck size={14} /> Mark all read
            </button>
          </div>
          <div className="notif-scroll">
            {!items ? (
              <div className="stack tight" style={{ padding: 12 }}>
                <div className="skeleton" style={{ height: 44 }} />
                <div className="skeleton" style={{ height: 44 }} />
              </div>
            ) : items.length ? (
              items.slice(0, 15).map((n) => <NotificationRow key={n.id} n={n} onOpen={() => setOpen(false)} />)
            ) : (
              <div className="empty small">Nothing yet. Mentions, replies, invites and reminders show up here.</div>
            )}
          </div>
          <Link href="/notifications" className="menu-item" style={{ justifyContent: "center", borderTop: "1px solid var(--line)", borderRadius: 0 }} onClick={() => setOpen(false)}>
            See all
          </Link>
        </div>
      ) : null}
    </div>
  );
}
