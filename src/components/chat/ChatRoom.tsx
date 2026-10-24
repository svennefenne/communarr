"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Bell, BellOff, ChevronLeft, CornerUpLeft, Ellipsis, Hash, LogOut, Pin, Send, Settings, Trash2, UserPlus, Users, X, Archive, AtSign } from "lucide-react";
import type { ChatMessage, RoomInfo, RoomMember } from "@/lib/chatTypes";
import type { Reaction, UserSummary } from "@/lib/types";
import { useApp, useLive, useT, useToast } from "@/components/app/AppProvider";
import { clientT } from "@/lib/i18n";
import { RichEditor, type EditorHandle } from "@/components/editor/Editor";
import { VoiceButton } from "@/components/voice/VoiceDock";
import { Dropdown, Modal, useConfirm } from "@/components/ui/ui";
import { PeoplePicker } from "@/components/ui/PeoplePicker";
import { UserChip } from "@/components/ui/Avatar";
import { ReportDialog } from "@/components/content/ReportDialog";
import { applyReaction } from "@/components/content/Reactions";
import { RoomIcon } from "./ChatSidebar";
import { Message, type MessageHandlers } from "./Message";
import { RoomSettings } from "./RoomSettings";
import {
  declineInviteAction,
  deleteMessageAction,
  deleteRoomAction,
  editMessageAction,
  inviteToRoomAction,
  joinRoomAction,
  leaveRoomAction,
  markReadAction,
  membersAction,
  messagesAction,
  pinMessageAction,
  pinnedAction,
  reactMessageAction,
  removeMemberAction,
  roomInfoAction,
  sendAction,
  setMemberRoleAction,
  setNotifyAction,
  typingAction,
  archiveRoomAction,
} from "@/app/actions/chat";

interface Props {
  info: RoomInfo;
  initial: { messages: ChatMessage[]; more: boolean };
  members: RoomMember[];
  reads: { userId: number; lastId: number }[];
  lastRead: number;
  canManage: boolean;
  isOwner: boolean;
}

const dayOf = (t: number) => new Date(t).toDateString();
function dayLabel(t: number) {
  const tr = clientT();
  const d = new Date(t);
  const today = new Date();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return tr("Today");
  if (d.toDateString() === y.toDateString()) return tr("Yesterday");
  return d.toLocaleDateString(tr.locale, { weekday: "long", day: "numeric", month: "long", ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) });
}

type RawReaction = { emoji: string; count: number; users: string[]; ids: number[] };

export function ChatRoom(p: Props) {
  const { me, setRoom } = useApp();
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const search = useSearchParams();
  const [info, setInfo] = useState(p.info);
  const [msgs, setMsgs] = useState<ChatMessage[]>(p.initial.messages);
  const [more, setMore] = useState(p.initial.more);
  const [members, setMembers] = useState(p.members);
  const [reads, setReads] = useState(p.reads);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [typing, setTyping] = useState<Map<number, { name: string; until: number }>>(new Map());
  const [highlight, setHighlight] = useState<number | null>(Number(search.get("m")) || null);
  const [newBelow, setNewBelow] = useState(0);
  const [panel, setPanel] = useState<null | "members" | "pinned" | "settings" | "invite">(null);
  const [pinnedList, setPinnedList] = useState<ChatMessage[] | null>(null);
  const [reporting, setReporting] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const { confirm, node } = useConfirm();
  const scroller = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorHandle>(null);
  const atBottom = useRef(true);
  const lastMarked = useRef(0);
  const prevHeight = useRef<number | null>(null);
  const lastTyping = useRef(0);
  const firstUnread = useRef(p.lastRead);
  const id = info.id;

  // this tab is showing the room: no unread count or notification for it
  useEffect(() => {
    setRoom(id);
    document.documentElement.classList.add("app-page", "in-room");
    return () => {
      setRoom(null);
      document.documentElement.classList.remove("app-page", "in-room");
    };
  }, [id, setRoom]);

  const scrollToBottom = (smooth = false) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  // first paint: at the bottom, or at the message linked to
  useLayoutEffect(() => {
    if (highlight && document.getElementById(`m-${highlight}`)) document.getElementById(`m-${highlight}`)!.scrollIntoView({ block: "center" });
    else scrollToBottom();
    // pictures load later and push things down
    const imgs = scroller.current?.querySelectorAll("img") ?? [];
    imgs.forEach((i) => i.addEventListener("load", () => atBottom.current && !highlight && scrollToBottom(), { once: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // older messages put above: keep what you were looking at in place
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && prevHeight.current != null) {
      el.scrollTop += el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    }
  }, [msgs]);

  const markRead = useCallback(() => {
    const last = msgs[msgs.length - 1];
    if (!last || !info.myRole || last.id <= lastMarked.current || document.visibilityState !== "visible") return;
    lastMarked.current = last.id;
    void markReadAction(id, last.id);
  }, [msgs, id, info.myRole]);

  useEffect(() => {
    const t = setTimeout(() => atBottom.current && markRead(), 500);
    return () => clearTimeout(t);
  }, [msgs, markRead]);
  useEffect(() => {
    const on = () => document.visibilityState === "visible" && atBottom.current && markRead();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, [markRead]);

  const onScroll = async () => {
    const el = scroller.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current) {
      setNewBelow(0);
      markRead();
    }
    if (el.scrollTop < 200 && more && prevHeight.current == null && msgs.length) {
      prevHeight.current = el.scrollHeight;
      const r = await messagesAction(id, { before: msgs[0].id });
      if (r.ok) {
        setMore(r.data.more);
        setMsgs((x) => [...r.data.messages.filter((m) => !x.some((y) => y.id === m.id)), ...x]);
      } else prevHeight.current = null;
    }
  };

  const jump = useCallback(
    async (mid: number) => {
      const el = document.getElementById(`m-${mid}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlight(mid);
        return;
      }
      const r = await messagesAction(id, { around: mid });
      if (r.ok) {
        setMsgs(r.data.messages);
        setMore(true);
        setHighlight(mid);
        setTimeout(() => document.getElementById(`m-${mid}`)?.scrollIntoView({ block: "center" }), 50);
      }
    },
    [id],
  );
  useEffect(() => {
    if (!highlight) return;
    const t = setTimeout(() => setHighlight(null), 3000);
    return () => clearTimeout(t);
  }, [highlight]);

  // ── live ──
  useLive("msg", (d) => {
    const { room, message } = d as { room: number; message: ChatMessage };
    if (room !== id) return;
    setMsgs((x) => (x.some((m) => m.id === message.id) ? x : [...x, message]));
    setTyping((t) => {
      if (!message.author || !t.has(message.author.id)) return t;
      const n = new Map(t);
      n.delete(message.author.id);
      return n;
    });
    if (message.author?.id === me?.id || atBottom.current) requestAnimationFrame(() => scrollToBottom(true));
    else setNewBelow((n) => n + 1);
  });
  useLive("msgEdit", (d) => {
    const { room, message } = d as { room: number; message: ChatMessage };
    if (room === id) setMsgs((x) => x.map((m) => (m.id === message.id ? { ...m, html: message.html, editedAt: message.editedAt } : m)));
  });
  useLive("msgDelete", (d) => {
    const e = d as { room: number; id: number };
    if (e.room === id) setMsgs((x) => x.map((m) => (m.id === e.id ? { ...m, deleted: true, html: "", reactions: [], pinned: false } : m)));
  });
  useLive("msgReact", (d) => {
    const e = d as { room: number; id: number; reactions: RawReaction[] };
    if (e.room !== id) return;
    const list: Reaction[] = e.reactions.map((r) => ({ emoji: r.emoji, count: r.count, users: r.users, mine: !!me && r.ids.includes(me.id) }));
    setMsgs((x) => x.map((m) => (m.id === e.id ? { ...m, reactions: list } : m)));
  });
  useLive("msgPin", (d) => {
    const e = d as { room: number; id: number; pinned: boolean };
    if (e.room === id) setMsgs((x) => x.map((m) => (m.id === e.id ? { ...m, pinned: e.pinned } : m)));
  });
  useLive("typing", (d) => {
    const e = d as { room: number; user: { id: number; name: string } };
    if (e.room !== id || e.user.id === me?.id) return;
    setTyping((t) => new Map(t).set(e.user.id, { name: e.user.name, until: Date.now() + 4500 }));
  });
  useLive("read", (d) => {
    const e = d as { room: number; user: number; lastId: number };
    if (e.room !== id) return;
    setReads((r) => [...r.filter((x) => x.userId !== e.user), { userId: e.user, lastId: e.lastId }]);
  });
  useLive("rooms", async (d) => {
    const e = d as { changed: number; deleted?: boolean; removed?: boolean };
    if (e.changed !== id) return;
    if (e.deleted || e.removed) {
      toast(e.deleted ? t("The room was deleted.") : t("You were removed from the room."));
      router.push("/chat");
      return;
    }
    const r = await roomInfoAction(id);
    if (r.ok) setInfo(r.data);
    const m = await membersAction(id);
    if (m.ok) setMembers(m.data);
  });
  // typing goes stale
  useEffect(() => {
    if (!typing.size) return;
    const t = setInterval(() => {
      setTyping((m) => {
        const n = new Map([...m].filter(([, v]) => v.until > Date.now()));
        return n.size === m.size ? m : n;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [typing.size]);

  // ── sending ──
  const send = async () => {
    const html = editor.current?.getHTML() ?? "";
    if (!html || sending) return;
    if (editor.current?.busy()) {
      toast(t("Wait for the pictures to finish uploading."));
      return;
    }
    setSending(true);
    const r = await sendAction(id, html, replyTo?.id);
    setSending(false);
    if (!r.ok) {
      toast(r.error, { kind: "err" });
      return;
    }
    editor.current?.clear();
    setReplyTo(null);
    // the others stopped seeing you type when the message arrived: tell them again as soon as you do
    lastTyping.current = 0;
    setMsgs((x) => (x.some((m) => m.id === r.data.id) ? x : [...x, r.data]));
    if (!info.myRole) setInfo((i) => ({ ...i, myRole: "member" }));
    requestAnimationFrame(() => scrollToBottom(true));
    editor.current?.focus();
  };
  const onType = () => {
    if (Date.now() - lastTyping.current > 3000) {
      lastTyping.current = Date.now();
      void typingAction(id);
    }
  };

  const h: MessageHandlers = {
    onReply: (m) => {
      setReplyTo(m);
      editor.current?.focus();
    },
    onReact: async (m, emoji) => {
      setMsgs((x) => x.map((y) => (y.id === m.id ? { ...y, reactions: applyReaction(y.reactions, emoji, me?.name ?? "") } : y)));
      const r = await reactMessageAction(m.id, emoji);
      if (r.ok) setMsgs((x) => x.map((y) => (y.id === m.id ? { ...y, reactions: r.data } : y)));
      else toast(r.error, { kind: "err" });
    },
    onEdit: async (m, html) => {
      const r = await editMessageAction(m.id, html);
      if (!r.ok) {
        toast(r.error, { kind: "err" });
        return false;
      }
      setMsgs((x) => x.map((y) => (y.id === m.id ? { ...y, html: r.data.html, editedAt: r.data.editedAt } : y)));
      return true;
    },
    onDelete: (m) =>
      confirm(t("Delete this message?"), t("Delete"), async () => {
        const r = await deleteMessageAction(m.id);
        if (!r.ok) toast(r.error, { kind: "err" });
      }),
    onPin: async (m) => {
      const r = await pinMessageAction(m.id, !m.pinned);
      if (!r.ok) toast(r.error, { kind: "err" });
    },
    onReport: (m) => setReporting(m.id),
    onJump: jump,
  };

  // "seen by": under the latest message, who has read all the way down (not you, not its writer)
  const people = useMemo(() => new Map(members.map((m) => [m.user.id, m.user])), [members]);
  const readersAt = useMemo(() => {
    const map = new Map<number, UserSummary[]>();
    const last = [...msgs].reverse().find((m) => m.kind === "text" && !m.deleted);
    if (!last) return map;
    const seen = reads
      .filter((r) => r.userId !== me?.id && r.userId !== last.author?.id && r.lastId >= last.id)
      .map((r) => people.get(r.userId))
      .filter((u): u is UserSummary => !!u);
    if (seen.length) map.set(last.id, seen);
    return map;
  }, [reads, msgs, people, me?.id]);
  const otherRead = info.kind === "dm" && info.other ? reads.find((r) => r.userId === info.other!.id)?.lastId ?? 0 : 0;
  const myLast = [...msgs].reverse().find((m) => m.author?.id === me?.id && !m.deleted);

  const typingNames = [...typing.values()].map((t) => t.name.split(" ")[0]);
  const isMember = !!info.myRole;
  const canModerate = p.canManage || !!me?.isMod;

  if (!me) return null;
  return (
    <section className="panel chat-room">
      <header className="chat-head">
        <Link href="/chat" className="icon-btn sm chat-back" aria-label={t("All chats")}>
          <ChevronLeft size={20} />
        </Link>
        <RoomIcon r={info} size={36} />
        <button type="button" className="chat-title" onClick={() => setPanel(info.kind === "dm" ? "members" : "settings")}>
          <b className="ellipsis">{info.name}</b>
          <span className="tiny muted ellipsis">
            {info.kind === "dm" ? (info.other?.statusText ? `${info.other.statusEmoji} ${info.other.statusText}` : t("Direct message")) : info.topic || t.n(info.memberCount, "{n} member", "{n} members")}
          </span>
        </button>
        {/* the buttons: beside the name on a computer, their own row under it on a phone */}
        <div className="chat-actions">
          {isMember || info.visibility === "open" ? (
            <div className="chat-voice">
              <VoiceButton room={id} name={info.name} compact />
            </div>
          ) : null}
          <button
            type="button"
            className="icon-btn sm"
            title={t("Pinned messages")}
            aria-label={t("Pinned messages")}
            onClick={async () => {
              setPanel("pinned");
              const r = await pinnedAction(id);
              if (r.ok) setPinnedList(r.data);
            }}
          >
            <Pin size={18} />
          </button>
          {info.kind !== "dm" ? (
            <button type="button" className="icon-btn sm" title={t("Members")} aria-label={t("Members")} onClick={() => setPanel("members")}>
              <Users size={18} />
            </button>
          ) : null}
          {isMember ? (
            <Dropdown label={t("Room menu")} button={<Ellipsis size={18} />}>
              <div className="menu-label">{t("Notify me about")}</div>
              {(
                [
                  ["all", Bell, "Every message"],
                  ["mentions", AtSign, "Only @mentions"],
                  ["none", BellOff, "Nothing"],
                ] as const
              ).map(([mode, Icon, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={`menu-item ${info.notify === mode ? "sel" : ""}`}
                  data-close
                  onClick={async () => {
                    const r = await setNotifyAction(id, mode);
                    if (r.ok) setInfo((i) => ({ ...i, notify: r.data }));
                  }}
                >
                  <Icon size={16} /> {t(label)}
                </button>
              ))}
              {info.kind !== "dm" ? (
                <>
                  <div className="menu-sep" />
                  {info.kind === "room" ? (
                    <button type="button" className="menu-item" data-close onClick={() => setPanel("invite")}>
                      <UserPlus size={16} /> {t("Invite people")}
                    </button>
                  ) : null}
                  {p.canManage ? (
                    <button type="button" className="menu-item" data-close onClick={() => setPanel("settings")}>
                      <Settings size={16} /> {t("Room settings")}
                    </button>
                  ) : null}
                  {p.canManage ? (
                    <button
                      type="button"
                      className="menu-item"
                      data-close
                      onClick={async () => {
                        const r = await archiveRoomAction(id, !info.archived);
                        if (r.ok) {
                          toast(r.data ? t("Archived: it's hidden from the lists.") : t("Back from the archive."));
                          router.push("/chat");
                        }
                      }}
                    >
                      <Archive size={16} /> {info.archived ? t("Unarchive") : t("Archive")}
                    </button>
                  ) : null}
                  {info.kind === "room" ? (
                    <button
                      type="button"
                      className="menu-item"
                      data-close
                      onClick={() =>
                        confirm(t("Leave {name}?", { name: info.name }), t("Leave"), async () => {
                          await leaveRoomAction(id);
                          router.push("/chat");
                        })
                      }
                    >
                      <LogOut size={16} /> {t("Leave the room")}
                    </button>
                  ) : null}
                  {p.isOwner || me.isAdmin ? (
                    <button
                      type="button"
                      className="menu-item danger"
                      data-close
                      onClick={() =>
                        confirm(t("Delete {name} and all its messages for everyone?", { name: info.name }), t("Delete"), async () => {
                          const r = await deleteRoomAction(id);
                          if (r.ok) router.push("/chat");
                          else toast(r.error, { kind: "err" });
                        })
                      }
                    >
                      <Trash2 size={16} /> {t("Delete the room")}
                    </button>
                  ) : null}
                </>
              ) : null}
            </Dropdown>
          ) : null}
        </div>
      </header>

      <div className="chat-scroll" ref={scroller} onScroll={onScroll}>
        {more ? <div className="chat-more tiny faint">{t("Loading older messages…")}</div> : <div className="chat-start">
          <RoomIcon r={info} size={56} />
          <b className="h3">{info.kind === "dm" ? t("You and {name}", { name: info.name }) : info.name}</b>
          <span className="small muted">{info.kind === "dm" ? t("This is the start of your messages.") : info.topic || t("The very beginning of the room.")}</span>
        </div>}
        {msgs.map((m, i) => {
          const prev = msgs[i - 1];
          const newDay = !prev || dayOf(prev.createdAt) !== dayOf(m.createdAt);
          const compact = !newDay && !!prev && prev.kind === "text" && m.kind === "text" && prev.author?.id === m.author?.id && m.createdAt - prev.createdAt < 5 * 60_000 && !m.replyTo;
          const unreadLine = firstUnread.current && m.id > firstUnread.current && (!prev || prev.id <= firstUnread.current) && m.author?.id !== me.id;
          return (
            <div key={m.id}>
              {newDay ? (
                <div className="chat-day">
                  <span suppressHydrationWarning>{dayLabel(m.createdAt)}</span>
                </div>
              ) : null}
              {unreadLine ? (
                <div className="chat-new">
                  <span>{t("New")}</span>
                </div>
              ) : null}
              <Message m={m} me={me} compact={compact} canModerate={canModerate} readers={info.kind === "dm" ? [] : readersAt.get(m.id) ?? []} seen={info.kind === "dm" && m.id === myLast?.id && otherRead >= m.id} highlight={highlight === m.id} h={h} />
            </div>
          );
        })}
      </div>

      {newBelow ? (
        <button type="button" className="fresh-pill chat-new-below" onClick={() => scrollToBottom(true)}>
          <ArrowDown size={15} /> {t.n(newBelow, "{n} new message", "{n} new messages")}
        </button>
      ) : null}

      <footer className="chat-foot">
        <div className="chat-typing tiny muted">{typingNames.length ? t.n(typingNames.length, "{names} is typing…", "{names} are typing…", { names: typingNames.slice(0, 3).join(", ") }) : " "}</div>
        {info.invited && !isMember ? (
          <div className="chat-banner">
            <span className="grow">{t("You're invited to this room.")}</span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={async () => {
                const r = await joinRoomAction(id);
                if (r.ok) setInfo((i) => ({ ...i, myRole: "member", invited: false }));
                else toast(r.error, { kind: "err" });
              }}
            >
              {t("Join")}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                await declineInviteAction(id);
                router.push("/chat");
              }}
            >
              {t("No thanks")}
            </button>
          </div>
        ) : !isMember ? (
          <div className="chat-banner">
            <Hash size={16} />
            <span className="grow small">{t("You're looking in. Join to get its messages in your list (writing something joins you too).")}</span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={async () => {
                const r = await joinRoomAction(id);
                if (r.ok) setInfo((i) => ({ ...i, myRole: "member" }));
                else toast(r.error, { kind: "err" });
              }}
            >
              {t("Join")}
            </button>
          </div>
        ) : null}
        {replyTo ? (
          <div className="chat-replying">
            <CornerUpLeft size={14} />
            <span className="grow ellipsis small">
              {t("Replying to")} <b>{replyTo.author?.name}</b>: <span className="muted">{replyTo.html.replace(/<[^>]+>/g, " ").trim().slice(0, 120)}</span>
            </span>
            <button type="button" className="icon-btn xs" onClick={() => setReplyTo(null)} aria-label={t("Cancel the reply")}>
              <X size={14} />
            </button>
          </div>
        ) : null}
        {!info.archived && (isMember || info.visibility === "open") ? (
          <RichEditor
            ref={editor}
            variant="compact"
            enterSends
            placeholder={info.kind === "dm" ? t("Message {name}", { name: info.name }) : t("Message {room}", { room: `${info.emoji ? info.emoji + " " : "#"}${info.name}` })}
            draftKey={`chat-${id}`}
            onSubmit={send}
            onChange={onType}
            label={t("Message")}
            className="chat-editor"
            actions={
              <button type="button" className={`btn btn-primary btn-sm chat-send ${sending ? "loading" : ""}`} onClick={send} aria-label={t("Send")} title={t("Send (Enter)")}>
                <Send size={16} />
              </button>
            }
          />
        ) : info.archived ? (
          <div className="chat-banner small muted">{t("This room is archived.")}</div>
        ) : null}
      </footer>

      {panel === "members" ? (
        <Modal title={info.kind === "dm" ? info.name : `${t("Members")} · ${members.length}`} onClose={() => setPanel(null)}>
          <div className="stack tight">
            {members.map((mm) => (
              <div key={mm.user.id} className="row">
                <UserChip user={mm.user} size={34} presence sub={mm.role !== "member" ? t(mm.role) : mm.user.statusText ? `${mm.user.statusEmoji} ${mm.user.statusText}` : undefined} />
                <span className="spacer" />
                {p.canManage && mm.user.id !== me.id && mm.role !== "owner" && info.kind !== "dm" ? (
                  <Dropdown label={t("Manage")} button={<Ellipsis size={16} />}>
                    <button
                      type="button"
                      className="menu-item"
                      data-close
                      onClick={async () => {
                        await setMemberRoleAction(id, mm.user.id, mm.role === "admin" ? "member" : "admin");
                        const r = await membersAction(id);
                        if (r.ok) setMembers(r.data);
                      }}
                    >
                      {mm.role === "admin" ? t("Not admin any more") : t("Make admin")}
                    </button>
                    <button
                      type="button"
                      className="menu-item danger"
                      data-close
                      onClick={async () => {
                        const r = await removeMemberAction(id, mm.user.id);
                        if (!r.ok) toast(r.error, { kind: "err" });
                        const m = await membersAction(id);
                        if (m.ok) setMembers(m.data);
                      }}
                    >
                      {t("Remove from the room")}
                    </button>
                  </Dropdown>
                ) : null}
              </div>
            ))}
            {info.kind === "room" && isMember ? (
              <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start", marginTop: 8 }} onClick={() => setPanel("invite")}>
                <UserPlus size={15} /> {t("Invite people")}
              </button>
            ) : null}
          </div>
        </Modal>
      ) : null}
      {panel === "invite" ? (
        <PeoplePicker
          title={t("Invite to {name}", { name: info.name })}
          exclude={members.map((m) => m.user.id)}
          onClose={() => setPanel(null)}
          onDone={async (ids) => {
            const r = await inviteToRoomAction(id, ids);
            if (r.ok) {
              toast(t("Invited {n}.", { n: r.data }));
              setPanel(null);
            } else toast(r.error, { kind: "err" });
          }}
        />
      ) : null}
      {panel === "pinned" ? (
        <Modal title={t("Pinned")} onClose={() => setPanel(null)}>
          {!pinnedList ? (
            <div className="skeleton" style={{ height: 60 }} />
          ) : pinnedList.length ? (
            <div className="stack tight">
              {pinnedList.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="pinned-item"
                  onClick={() => {
                    setPanel(null);
                    void jump(m.id);
                  }}
                >
                  <b className="small">{m.author?.name}</b>
                  <span className="small dim clamp-2">{m.html.replace(/<[^>]+>/g, " ").trim()}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted small">{t("Nothing pinned. Pin a message from its ⋯ menu to keep it handy here.")}</p>
          )}
        </Modal>
      ) : null}
      {panel === "settings" ? <RoomSettings info={info} canManage={p.canManage} onClose={() => setPanel(null)} onSaved={(i) => setInfo(i)} /> : null}
      {reporting ? <ReportDialog type="message" id={reporting} onClose={() => setReporting(null)} /> : null}
      {node}
    </section>
  );
}
