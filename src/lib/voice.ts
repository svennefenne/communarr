import "server-only";
import { broadcast, sendToConn, sendToMany } from "./hub";
import { getSettings, type IceServer } from "./settings";
import { db } from "./db";

/**
 * Voice chat: every chat room has a voice channel. Each tab in a channel calls every other one
 * directly (WebRTC, a small mesh: fine for a group of friends); the server only passes the calls'
 * set-up messages between them, over the live streams. A TURN server (Admin → Voice) helps phones on
 * mobile data reach the others.
 */

export interface VoicePeer {
  conn: number;
  userId: number;
  muted: boolean;
  joinedAt: number;
}

type Channels = Map<number, Map<number, VoicePeer>>;
const g = globalThis as typeof globalThis & { __hdVoice?: Channels };
const channels: Channels = (g.__hdVoice ??= new Map());

export function iceServers(): IceServer[] {
  const s = getSettings().voice;
  const list = [...s.ice];
  const turn = process.env.VOICE_TURN_URL;
  if (turn && !list.some((x) => x.urls === turn)) list.push({ urls: turn, username: process.env.VOICE_TURN_USER, credential: process.env.VOICE_TURN_PASS });
  return list;
}

function audience(roomId: number): number[] | "all" {
  const r = db().prepare("select visibility, kind from rooms where id = ?").get(roomId) as { visibility: string; kind: string } | undefined;
  if (!r) return [];
  if (r.visibility === "open" && r.kind === "room") return "all";
  return (db().prepare("select user_id from room_members where room_id = ?").all(roomId) as { user_id: number }[]).map((x) => x.user_id);
}

export function voicePeers(roomId: number): VoicePeer[] {
  return [...(channels.get(roomId)?.values() ?? [])].sort((a, b) => a.joinedAt - b.joinedAt);
}

/** Every room's channel with anyone in it: { room: peers } */
export function voiceSnapshot(): Record<number, VoicePeer[]> {
  const out: Record<number, VoicePeer[]> = {};
  for (const [room, peers] of channels) if (peers.size) out[room] = voicePeers(room);
  return out;
}

function announce(roomId: number) {
  const data = { room: roomId, peers: voicePeers(roomId) };
  const who = audience(roomId);
  if (who === "all") broadcast("voiceState", data);
  else sendToMany(who, "voiceState", data);
}

export function joinVoice(userId: number, roomId: number, conn: number): VoicePeer[] | "full" {
  leaveVoiceConn(conn);
  let ch = channels.get(roomId);
  if (!ch) channels.set(roomId, (ch = new Map()));
  if (ch.size >= getSettings().voice.max) return "full";
  const others = voicePeers(roomId);
  ch.set(conn, { conn, userId, muted: false, joinedAt: Date.now() });
  announce(roomId);
  return others;
}

export function leaveVoice(roomId: number, conn: number) {
  const ch = channels.get(roomId);
  if (!ch?.delete(conn)) return;
  if (!ch.size) channels.delete(roomId);
  for (const p of ch.values()) sendToConn(p.conn, "voiceGone", { room: roomId, conn });
  announce(roomId);
}

/** A tab closed: out of any channel it was in. */
export function leaveVoiceConn(conn: number) {
  for (const [room, ch] of channels) if (ch.has(conn)) leaveVoice(room, conn);
}

export function muteVoice(roomId: number, conn: number, muted: boolean) {
  const p = channels.get(roomId)?.get(conn);
  if (!p) return;
  p.muted = muted;
  announce(roomId);
}

/** Pass a call's set-up message (offer, answer, ICE candidate) to another tab in the channel. */
export function relayVoice(roomId: number, from: number, to: number, data: unknown): boolean {
  const ch = channels.get(roomId);
  const sender = ch?.get(from);
  if (!sender || !ch?.has(to)) return false;
  sendToConn(to, "voiceSignal", { room: roomId, from, fromUser: sender.userId, data });
  return true;
}

export function inVoice(roomId: number, conn: number) {
  return !!channels.get(roomId)?.has(conn);
}
