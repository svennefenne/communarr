"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, CheckCheck, Settings } from "lucide-react";
import type { NotificationItem } from "@/lib/types";
import { useApp, useLive, useT } from "@/components/app/AppProvider";
import { Empty } from "@/components/ui/ui";
import { NotificationRow } from "./NotificationBell";
import { listNotificationsAction, markReadAction } from "@/app/actions/notifications";

export function NotificationList({ initial }: { initial: NotificationItem[] }) {
  const { counts } = useApp();
  const t = useT();
  const [items, setItems] = useState(initial);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [more, setMore] = useState(initial.length >= 30);
  const [busy, setBusy] = useState(false);
  useLive("notify", (d) => setItems((l) => [(d as { item: NotificationItem }).item, ...l]));
  const load = async (only: boolean, before?: number) => {
    setBusy(true);
    const list = await listNotificationsAction(before, only);
    setBusy(false);
    setMore(list.length >= 30);
    setItems((l) => (before ? [...l, ...list] : list));
  };
  const shown = unreadOnly ? items.filter((n) => !n.read) : items;
  return (
    <div className="stack">
      <div className="row between wrap">
        <div className="pills">
          <button
            type="button"
            className={`pill ${!unreadOnly ? "active" : ""}`}
            onClick={() => {
              setUnreadOnly(false);
              void load(false);
            }}
          >
            {t("All")}
          </button>
          <button
            type="button"
            className={`pill ${unreadOnly ? "active" : ""}`}
            onClick={() => {
              setUnreadOnly(true);
              void load(true);
            }}
          >
            {t("Unread")} {counts.notifications ? `· ${counts.notifications}` : ""}
          </button>
        </div>
        <div className="row">
          <button
            type="button"
            className="btn btn-sm"
            disabled={!counts.notifications}
            onClick={async () => {
              await markReadAction("all");
              setItems((l) => l.map((n) => ({ ...n, read: true })));
            }}
          >
            <CheckCheck size={15} /> {t("Mark all read")}
          </button>
          <Link href="/settings/notifications" className="btn btn-sm">
            <Settings size={15} /> {t("Settings")}
          </Link>
        </div>
      </div>
      <div className="panel list">
        {shown.map((n) => (
          <NotificationRow
            key={n.id}
            n={n}
            onOpen={() => {
              if (!n.read) void markReadAction([n.id]);
            }}
          />
        ))}
        {!shown.length ? <Empty icon={<Bell size={24} />} title={unreadOnly ? t("All caught up") : t("Nothing yet")}>{t("Mentions, replies, invitations and reminders show up here.")}</Empty> : null}
      </div>
      {more ? (
        <button type="button" className={`btn ${busy ? "loading" : ""}`} style={{ alignSelf: "center" }} onClick={() => load(unreadOnly, items[items.length - 1]?.id)}>
          {t("Older")}
        </button>
      ) : null}
    </div>
  );
}
