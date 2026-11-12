"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpDown, Hash, Headphones, Lock, Mail, PanelLeftClose, PanelLeftOpen, Plus, Search, UsersRound } from "lucide-react";
import { byPlace, type RoomInfo } from "@/lib/chatTypes";
import type { ChatMessage } from "@/lib/chatTypes";
import { useApp, useLive, useT, useToast } from "@/components/app/AppProvider";
import { useVoice } from "@/components/voice/VoiceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { relative } from "@/components/ui/Time";
import { NewChat } from "./NewChat";
import { ArrangeRooms } from "./ArrangeRooms";
import { useChatUi } from "./ChatShell";
import { TypingDots, TypingLine, useTyping, type Typer } from "./useTyping";
import { declineInviteAction, joinRoomAction, roomsAction } from "@/app/actions/chat";

export function RoomIcon({ r, size = 38 }: { r: Pick<RoomInfo, "kind" | "emoji" | "visibility" | "other">; size?: number }) {
  if (r.kind === "dm" && r.other) return <Avatar user={r.other} size={size} presence />;
  return (
    <span className="room-icon" style={{ width: size, height: size, fontSize: size * 0.48 }}>
      {r.emoji || (r.kind === "group" ? <UsersRound size={size * 0.45} /> : r.visibility === "private" ? <Lock size={size * 0.42} /> : <Hash size={size * 0.45} />)}
    </span>
  );
}

/** "5 min ago" without the "ago" (and "för 5 min sedan" without "för … sedan"): the list is tight. */
const short = (s: string) => s.replace(/ ago$/, "").replace(/^för (.+) sedan$/, "$1");

function Row({ r, active, unread, talking, typers = [] }: { r: RoomInfo; active: boolean; unread: number; talking: number; typers?: Typer[] }) {
  const t = useT();
  const live = useVoice().channels[r.id]?.some((p) => p.live);
  return (
    <Link href={`/chat/${r.id}`} className={`chat-row ${active ? "active" : ""} ${unread ? "unread" : ""}`}>
      <RoomIcon r={r} />
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="row" style={{ gap: 6 }}>
          <b className="ellipsis grow">{r.name}</b>
          {r.lastMessageAt ? (
            <span className="tiny faint" suppressHydrationWarning>
              {short(relative(r.lastMessageAt))}
            </span>
          ) : null}
        </span>
        <span className="row" style={{ gap: 6 }}>
          {/* someone typing there: that, in place of the last message (in a DM, just that they are) */}
          {typers.length ? (
            <span className="tiny ellipsis grow chat-row-typing">
              {r.kind === "dm" ? (
                <>
                  <TypingDots /> {t("typing…")}
                </>
              ) : (
                <TypingLine typers={typers} />
              )}
            </span>
          ) : (
            <span className="tiny muted ellipsis grow">{r.lastMessage ? `${r.lastMessage.author ? `${r.lastMessage.author.split(" ")[0]}: ` : ""}${r.lastMessage.text}` : r.topic || " "}</span>
          )}
          {live ? (
            <span className="live-tag" title={t("Someone is sharing their screen")}>
              {t("LIVE")}
            </span>
          ) : null}
          {talking ? (
            <span className="badge teal" title={t("{n} talking", { n: talking })}>
              <Headphones size={11} /> {talking}
            </span>
          ) : null}
          {unread ? <span className="count-badge" style={{ position: "static", boxShadow: "none" }}>{unread > 99 ? "99+" : unread}</span> : null}
        </span>
      </span>
    </Link>
  );
}

/** A chat as only its icon (the list made narrow): its name when pointed at, a count of what's new, a sign if people are talking (red: someone's sharing their screen). */
function RailItem({ r, active, unread, talking, join = false }: { r: RoomInfo; active: boolean; unread: number; talking: number; join?: boolean }) {
  const t = useT();
  const live = useVoice().channels[r.id]?.some((p) => p.live);
  return (
    <Link href={`/chat/${r.id}`} className={`rail-item ${active ? "active" : ""} ${join ? "join" : ""}`} title={r.name} aria-label={r.name} aria-current={active ? "page" : undefined}>
      <RoomIcon r={r} size={40} />
      {unread ? <span className="count-badge">{unread > 99 ? "99+" : unread}</span> : null}
      {talking ? (
        <span className={`rail-talk ${live ? "live" : ""}`} title={live ? t("Someone is sharing their screen") : t("{n} talking", { n: talking })}>
          <Headphones size={10} />
        </span>
      ) : null}
    </Link>
  );
}

/**
 * The list of chats: invitations, your rooms and messages, and open rooms you could join. On a
 * computer it can be made narrow, only the chats' icons (as on Discord), and back.
 */
export function ChatSidebar({ initial }: { initial: { mine: RoomInfo[]; open: RoomInfo[]; invites: RoomInfo[] } }) {
  const { counts, site, me } = useApp();
  const t = useT();
  const voice = useVoice();
  const typing = useTyping();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState(initial);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState<null | "dm" | "room">(null);
  const [arranging, setArranging] = useState(false);
  const activeId = Number(pathname.split("/")[2]) || 0;
  // (only the icons: a computer's or a tablet's; a phone shows the whole list or the room)
  const ui = useChatUi();
  const [roomy, setRoomy] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 700px)");
    const f = () => setRoomy(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);

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
      const r = { ...x.mine[i], lastMessageAt: message.createdAt, lastMessage: { author: message.author?.name ?? "", text: message.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || t("📷 Picture") } };
      return { ...x, mine: [r, ...x.mine.filter((_, j) => j !== i)] };
    });
  });

  const match = (r: RoomInfo) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.topic.toLowerCase().includes(q.toLowerCase());
  // rooms in the order an admin gave them (a new message doesn't move them); DMs newest first
  const rooms = data.mine.filter((r) => r.kind !== "dm" && match(r)).sort(byPlace);
  const dms = data.mine.filter((r) => r.kind === "dm" && match(r));
  const open = data.open.filter(match).sort(byPlace);

  if (arranging)
    return (
      <aside className="panel chat-side">
        <ArrangeRooms
          rooms={[...data.mine.filter((r) => r.kind !== "dm"), ...data.open].sort(byPlace)}
          onDone={async (saved) => {
            setArranging(false);
            if (saved) await refresh();
          }}
        />
      </aside>
    );

  if (ui.rail && roomy)
    return (
      <aside className="panel chat-side rail" aria-label={t("Chat")}>
        <div className="rail-head">
          <button type="button" className="icon-btn framed sm" onClick={() => ui.setRail(false)} title={t("Show the names")} aria-label={t("Show the names")}>
            <PanelLeftOpen size={16} />
          </button>
        </div>
        <div className="rail-list">
          {data.invites.map((r) => (
            <button key={r.id} type="button" className="rail-item invite" onClick={() => ui.setRail(false)} title={t("Invitation: {name}", { name: r.name })} aria-label={t("Invitation: {name}", { name: r.name })}>
              <RoomIcon r={r} size={40} />
            </button>
          ))}
          {data.invites.length ? <span className="rail-sep" /> : null}
          {rooms.map((r) => (
            <RailItem key={r.id} r={r} active={r.id === activeId} unread={counts.rooms[r.id] ?? 0} talking={voice.channels[r.id]?.length ?? 0} />
          ))}
          {dms.length ? <span className="rail-sep" /> : null}
          {dms.map((r) => (
            <RailItem key={r.id} r={r} active={r.id === activeId} unread={counts.rooms[r.id] ?? 0} talking={voice.channels[r.id]?.length ?? 0} />
          ))}
          {open.length ? <span className="rail-sep" /> : null}
          {open.map((r) => (
            <RailItem key={r.id} r={r} active={r.id === activeId} unread={0} talking={voice.channels[r.id]?.length ?? 0} join />
          ))}
        </div>
        <div className="rail-foot">
          <button type="button" className="icon-btn framed sm" onClick={() => setCreating("dm")} title={t("Message someone")} aria-label={t("Message someone")}>
            <Mail size={16} />
          </button>
          {site.can.rooms ? (
            <button type="button" className="icon-btn framed sm" onClick={() => setCreating("room")} title={t("New room")} aria-label={t("New room")}>
              <Plus size={17} />
            </button>
          ) : null}
        </div>
        {creating ? <NewChat initial={creating} onClose={() => setCreating(null)} /> : null}
      </aside>
    );

  return (
    <aside className="panel chat-side">
      <div className="chat-side-head">
        <h1 className="h2">{t("Chat")}</h1>
        <span className="spacer" />
        <button type="button" className="icon-btn framed sm" onClick={() => setCreating("dm")} title={t("Message someone")} aria-label={t("Message someone")}>
          <Mail size={16} />
        </button>
        {site.can.rooms ? (
          <button type="button" className="icon-btn framed sm" onClick={() => setCreating("room")} title={t("New room")} aria-label={t("New room")}>
            <Plus size={17} />
          </button>
        ) : null}
        {me?.isAdmin ? (
          <button type="button" className="icon-btn framed sm" onClick={() => setArranging(true)} title={t("Arrange the rooms")} aria-label={t("Arrange the rooms")}>
            <ArrowUpDown size={16} />
          </button>
        ) : null}
        <button
          type="button"
          className="icon-btn framed sm rail-toggle"
          onClick={() => {
            setQ("");
            ui.setRail(true);
          }}
          title={t("Only the icons")}
          aria-label={t("Only the icons")}
        >
          <PanelLeftClose size={16} />
        </button>
      </div>
      <div className="chat-search">
        <Search size={15} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Find a chat")} aria-label={t("Find a chat")} />
      </div>
      <div className="chat-side-scroll">
        {data.invites.length ? (
          <>
            <div className="menu-label">{t("Invitations")}</div>
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
                      {t("Join")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={async () => {
                        await declineInviteAction(r.id);
                        await refresh();
                      }}
                    >
                      {t("No thanks")}
                    </button>
                  </span>
                </span>
              </div>
            ))}
          </>
        ) : null}
        <div className="menu-label">{t("Rooms")}</div>
        {rooms.map((r) => (
          <Row key={r.id} r={r} typers={typing.get(r.id)} active={r.id === activeId} unread={counts.rooms[r.id] ?? 0} talking={voice.channels[r.id]?.length ?? 0} />
        ))}
        {!rooms.length ? <div className="tiny muted" style={{ padding: "4px 14px 10px" }}>{q ? t("No rooms found.") : t("No rooms yet.")}</div> : null}
        <div className="menu-label">{t("Direct messages")}</div>
        {dms.map((r) => (
          <Row key={r.id} r={r} typers={typing.get(r.id)} active={r.id === activeId} unread={counts.rooms[r.id] ?? 0} talking={voice.channels[r.id]?.length ?? 0} />
        ))}
        {!dms.length ? (
          <button type="button" className="btn btn-ghost btn-xs" style={{ margin: "2px 10px 10px" }} onClick={() => setCreating("dm")}>
            <Mail size={13} /> {t("Message someone")}
          </button>
        ) : null}
        {open.length ? (
          <>
            <div className="menu-label">{t("Open rooms to join")}</div>
            {open.map((r) => (
              <Row key={r.id} r={r} typers={typing.get(r.id)} active={r.id === activeId} unread={0} talking={voice.channels[r.id]?.length ?? 0} />
            ))}
          </>
        ) : null}
      </div>
      {creating ? <NewChat initial={creating} onClose={() => setCreating(null)} /> : null}
    </aside>
  );
}
