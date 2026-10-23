import "server-only";
import { db } from "./db";
import type { LiveState, Presence } from "./types";

/**
 * The live hub: every open page holds a Server-Sent Events stream (/api/live), and anything that
 * happens (a chat message, a notification, someone coming online, a voice call's set-up) is sent
 * down the streams of the people it concerns. One process, so plain maps on globalThis do (shared
 * by Next's separately bundled routes and server actions).
 */

export type Send = (type: string, data: unknown) => void;

export interface Conn {
  id: number;
  userId: number;
  send: Send;
  /** the tab is in sight right now (push notifications skip people looking at the site) */
  visible: boolean;
  /** out of sight for a while: counts as away */
  idle: boolean;
  /** the chat room this tab has open (no unread count, no notification for it) */
  room: number | null;
}

interface Hub {
  seq: number;
  conns: Map<number, Conn>;
  byUser: Map<number, Set<number>>;
  states: Map<number, LiveState>;
  offlineTimers: Map<number, ReturnType<typeof setTimeout>>;
}

const g = globalThis as typeof globalThis & { __hdHub?: Hub };
const hub: Hub = (g.__hdHub ??= { seq: 0, conns: new Map(), byUser: new Map(), states: new Map(), offlineTimers: new Map() });

function presencePref(userId: number): Presence {
  const r = db().prepare("select presence from users where id = ?").get(userId) as { presence: Presence } | undefined;
  return r?.presence ?? "auto";
}

/** What others see for someone right now. */
export function liveState(userId: number): LiveState {
  const ids = hub.byUser.get(userId);
  if (!ids?.size) return "offline";
  const pref = presencePref(userId);
  if (pref === "invisible") return "offline";
  if (pref === "busy") return "busy";
  if (pref === "away") return "away";
  for (const id of ids) if (!hub.conns.get(id)?.idle) return "online";
  return "away";
}

/** Tell everyone when someone's state changed. */
export function refreshPresence(userId: number) {
  const state = liveState(userId);
  if (hub.states.get(userId) === state) return;
  if (state === "offline") hub.states.delete(userId);
  else hub.states.set(userId, state);
  broadcast("presence", { id: userId, state });
}

export function presenceList(): { id: number; state: LiveState }[] {
  return [...hub.states.entries()].map(([id, state]) => ({ id, state }));
}

export function addConn(userId: number, send: Send): Conn {
  const conn: Conn = { id: ++hub.seq, userId, send, visible: true, idle: false, room: null };
  hub.conns.set(conn.id, conn);
  if (!hub.byUser.has(userId)) hub.byUser.set(userId, new Set());
  hub.byUser.get(userId)!.add(conn.id);
  const t = hub.offlineTimers.get(userId);
  if (t) {
    clearTimeout(t);
    hub.offlineTimers.delete(userId);
  }
  refreshPresence(userId);
  return conn;
}

export function removeConn(conn: Conn) {
  hub.conns.delete(conn.id);
  const set = hub.byUser.get(conn.userId);
  set?.delete(conn.id);
  if (set && !set.size) {
    hub.byUser.delete(conn.userId);
    // a reload reconnects within a moment: wait before calling them gone
    hub.offlineTimers.set(
      conn.userId,
      setTimeout(() => {
        hub.offlineTimers.delete(conn.userId);
        refreshPresence(conn.userId);
        db().prepare("update users set last_seen = ? where id = ?").run(Date.now(), conn.userId);
      }, 6000),
    );
  } else refreshPresence(conn.userId);
}

export function connById(id: number, userId: number): Conn | null {
  const c = hub.conns.get(id);
  return c && c.userId === userId ? c : null;
}

export function setVisibility(conn: Conn, visible: boolean, idle: boolean) {
  conn.visible = visible;
  conn.idle = idle;
  refreshPresence(conn.userId);
}

export function isLooking(userId: number): boolean {
  for (const id of hub.byUser.get(userId) ?? []) if (hub.conns.get(id)?.visible) return true;
  return false;
}

/** Someone has this room open in a tab they're looking at. */
export function isInRoom(userId: number, roomId: number): boolean {
  for (const id of hub.byUser.get(userId) ?? []) {
    const c = hub.conns.get(id);
    if (c?.visible && c.room === roomId) return true;
  }
  return false;
}

export function sendTo(userId: number, type: string, data: unknown) {
  for (const id of hub.byUser.get(userId) ?? []) hub.conns.get(id)?.send(type, data);
}

export function sendToConn(connId: number, type: string, data: unknown) {
  hub.conns.get(connId)?.send(type, data);
}

export function sendToMany(userIds: Iterable<number>, type: string, data: unknown) {
  for (const u of new Set(userIds)) sendTo(u, type, data);
}

export function broadcast(type: string, data: unknown) {
  for (const c of hub.conns.values()) c.send(type, data);
}

export function onlineCount(): number {
  return hub.states.size;
}

export function connectedUserIds(): number[] {
  return [...hub.byUser.keys()];
}
