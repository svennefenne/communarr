"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Hash, Headphones, Lock, Mail, Plus, Search, UsersRound } from "lucide-react";
import type { RoomInfo } from "@/lib/chatTypes";
import type { ChatMessage } from "@/lib/chatTypes";
import { useApp, useLive, useToast } from "@/components/app/AppProvider";
import { useVoice } from "@/components/voice/VoiceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { relative } from "@/components/ui/Time";
import { NewChat } from "./NewChat";
import { declineInviteAction, joinRoomAction, roomsAction } from "@/app/actions/chat";

export function RoomIcon({ r, size = 38 }: { r: Pick<RoomInfo, "kind" | "emoji" | "visibility" | "other">; size?: number }) {
  if (r.kind === "dm" && r.other) return <Avatar user={r.other} size={size} presence />;
  return (
    <span className="room-icon" style={{ width: size, height: size, fontSize: size * 0.48 }}>
      {r.emoji || (r.kind === "group" ? <UsersRound size={size * 0.45} /> : r.visibility === "private" ? <Lock size={size * 0.42} /> : <Hash size={size * 0.45} />)}
    </span>
  );
}

function Row({ r, active, unread, talking }: { r: RoomInfo; active: boolean; unread: number; talking: number }) {
  return (
    <Link href={`/chat/${r.id}`} className={`chat-row ${active ? "active" : ""} ${unread ? "unread" : ""}`}>
      <RoomIcon r={r} />
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="row" style={{ gap: 6 }}>
          <b className="ellipsis grow">{r.name}</b>
          {r.lastMessageAt ? (
            <span className="tiny faint" suppressHydrationWarning>
              {relative(r.lastMessageAt).replace(" ago", "")}
            </span>
          ) : null}
        </span>
        <span className="row" style={{ gap: 6 }}>
          <span className="tiny muted ellipsis grow">{r.lastMessage ? `${r.lastMessage.author ? `${r.lastMessage.author.split(" ")[0]}: ` : ""}${r.lastMessage.text}` : r.topic || " "}</span>
          {talking ? (
            <span className="badge teal" title={`${talking} talking`}>
              <Headphones size={11} /> {talking}
            </span>
          ) : null}
          {unread ? <span className="count-badge" style={{ position: "static", boxShadow: "none" }}>{unread > 99 ? "99+" : unread}</span> : null}
        </span>
      </span>
    </Link>
  );
}

/** The list of chats: invitations, your rooms and messages, and open rooms you could join. */
export function ChatSidebar({ initial }: { initial: { mine: RoomInfo[]; open: RoomInfo[]; invites: RoomInfo[] } }) {
  const { counts, site } = useApp();
  const voice = useVoice();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState(initial);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState<null | "dm" | "room">(null);
  const activeId = Number(pathname.split("/")[2]) || 0;

  const refresh = useCallback(async () => {
    const r = await roomsAction();
    if (r.ok) setData(r.data);
  }, []);
  useLive("rooms", () => void refresh());
  useLive("msg", (d) => {
    const { room, message } = d as { room: number; message: ChatMessage };
    setData((x) => {
      const i = x.mine.findIndex((r) => r.id === room);
      if (i < 0) {
        void refresh();
        return x;
      }
      const r = { ...x.mine[i], lastMessageAt: message.createdAt, lastMessage: { author: message.author?.name ?? "", text: message.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "📷 Picture" } };
      return { ...x, mine: [r, ...x.mine.filter((_, j) => j !== i)] };
    });
  });

  const match = (r: RoomInfo) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.topic.toLowerCase().includes(q.toLowerCase());
  const rooms = data.mine.filter((r) => r.kind !== "dm" && match(r));
  const dms = data.mine.filter((r) => r.kind === "dm" && match(r));
  const open = data.open.filter(match);

  return (
    <aside className="panel chat-side">
      <div className="chat-side-head">
        <h1 className="h2">Chat</h1>
        <span className="spacer" />
        <button type="button" className="icon-btn framed sm" onClick={() => setCreating("dm")} title="Message someone" aria-label="Message someone">
          <Mail size={16} />
        </button>
        {site.can.rooms ? (
          <button type="button" className="icon-btn framed sm" onClick={() => setCreating("room")} title="New room" aria-label="New room">
            <Plus size={17} />
          </button>
        ) : null}
      </div>
      <div className="chat-search">
        <Search size={15} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a chat" aria-label="Find a chat" />
      </div>
      <div className="chat-side-scroll">
        {data.invites.length ? (
          <>
            <div className="menu-label">Invitations</div>
            {data.invites.map((r) => (
              <div key={r.id} className="chat-row invite">
                <RoomIcon r={r} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <b className="ellipsis" style={{ display: "block" }}>
                    {r.name}
                  </b>
                  <span className="row" style={{ gap: 6, marginTop: 4 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-xs"
                      onClick={async () => {
                        const res = await joinRoomAction(r.id);
                        if (res.ok) {
                          await refresh();
                          router.push(`/chat/${r.id}`);
                        } else toast(res.error, { kind: "err" });
                      }}
                    >
                      Join
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={async () => {
                        await declineInviteAction(r.id);
                        await refresh();
                      }}
                    >
                      No thanks
                    </button>
                  </span>
                </span>
              </div>
            ))}
          </>
        ) : null}
        <div className="menu-label">Rooms</div>
        {rooms.map((r) => (
          <Row key={r.id} r={r} active={r.id === activeId} unread={counts.rooms[r.id] ?? 0} talking={voice.channels[r.id]?.length ?? 0} />
        ))}
        {!rooms.length ? <div className="tiny muted" style={{ padding: "4px 14px 10px" }}>No rooms{q ? " found" : " yet"}.</div> : null}
        <div className="menu-label">Direct messages</div>
        {dms.map((r) => (
          <Row key={r.id} r={r} active={r.id === activeId} unread={counts.rooms[r.id] ?? 0} talking={voice.channels[r.id]?.length ?? 0} />
        ))}
        {!dms.length ? (
          <button type="button" className="btn btn-ghost btn-xs" style={{ margin: "2px 10px 10px" }} onClick={() => setCreating("dm")}>
            <Mail size={13} /> Message someone
          </button>
        ) : null}
        {open.length ? (
          <>
            <div className="menu-label">Open rooms to join</div>
            {open.map((r) => (
              <Row key={r.id} r={r} active={r.id === activeId} unread={0} talking={voice.channels[r.id]?.length ?? 0} />
            ))}
          </>
        ) : null}
      </div>
      {creating ? <NewChat initial={creating} onClose={() => setCreating(null)} /> : null}
    </aside>
  );
}
