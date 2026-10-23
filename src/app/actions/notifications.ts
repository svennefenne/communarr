"use server";

import { requireUser } from "@/lib/auth";
import { listNotifications, markRead } from "@/lib/notify";

export async function listNotificationsAction(before?: number, unreadOnly = false) {
  const u = await requireUser();
  return listNotifications(u.id, { before, limit: 30, unread: unreadOnly });
}

export async function markReadAction(ids: number[] | "all") {
  const u = await requireUser();
  return markRead(u.id, ids === "all" ? "all" : ids.map(Number).filter(Number.isFinite));
}
