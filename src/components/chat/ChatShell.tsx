"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CHAT_UI_COOKIE, type ChatUi, type RoomInfo } from "@/lib/chatTypes";
import { ContextMenuHost } from "@/components/ui/ContextMenu";
import { useConfirm } from "@/components/ui/ui";
import { VoiceSettingsHost } from "@/components/voice/VoiceDock";
import { glideMs, slide, usePaneSwipe } from "./paneSwipe";

/** a phone's three panes, side by side: swipe between them */
export type ChatPane = "rooms" | "chat" | "people";
const PANE_CLASS: Record<ChatPane, string> = { rooms: "chat-side", chat: "chat-room", people: "chat-people" };
const PHONE = "(max-width: 699px)";

interface ChatCtx extends ChatUi {
  setRail: (on: boolean) => void;
  setPeople: (on: boolean) => void;
  /** the chats in the list (yours and the open ones), for names and menus elsewhere */
  rooms: RoomInfo[];
  setRooms: (r: RoomInfo[]) => void;
  /** ask before something that can't be undone (from a menu) */
  confirm: (text: string, yes: string, run: () => void | Promise<unknown>) => void;
  /** a phone: the chats, the room and its members are panes to swipe between */
  phone: boolean;
  pane: ChatPane;
  showPane: (p: ChatPane) => void;
}
const Ctx = createContext<ChatCtx>({ rail: false, people: true, setRail: () => {}, setPeople: () => {}, rooms: [], setRooms: () => {}, confirm: () => {}, phone: false, pane: "chat", showPane: () => {} });
export const useChatUi = () => useContext(Ctx);

/**
 * Chats side by side with the open room (and the room's members beside it on a wide screen). On a
 * phone the three are panes in a row, a screen wide each, to swipe between (paneSwipe): the chats, the
 * room (where it opens), the members. How it's laid out on a computer is kept on this device, in a cookie, so the
 * server draws it that way from the start.
 */
export function ChatShell({ initial, children }: { initial: ChatUi; children: React.ReactNode }) {
  const pathname = usePathname();
  const inRoom = /^\/chat\/\d+/.test(pathname);
  const [ui, setUi] = useState(initial);
  const save = useCallback((next: ChatUi) => {
    setUi(next);
    document.cookie = `${CHAT_UI_COOKIE}=${next.rail ? 1 : 0}${next.people ? 1 : 0}; path=/; max-age=${400 * 86_400}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
  }, []);
  const setRail = useCallback((rail: boolean) => save({ ...ui, rail }), [save, ui]);
  const setPeople = useCallback((people: boolean) => save({ ...ui, people }), [save, ui]);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const { confirm, node } = useConfirm();

  const shell = useRef<HTMLDivElement>(null);
  const [phone, setPhone] = useState(false);
  const [pane, setPaneState] = useState<ChatPane>("chat");
  // (the server draws a phone's room first, the chats out of the row, so it opens on the room before
  // anything runs; once it does, the chats go back in the row, scrolled past)
  const [placed, setPlaced] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia(PHONE);
    const f = () => setPhone(mq.matches);
    f();
    setPlaced(true);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);

  const paneEl = useCallback((p: ChatPane) => shell.current?.querySelector<HTMLElement>(`:scope > .${PANE_CLASS[p]}`) ?? null, []);
  const showPane = useCallback(
    (p: ChatPane, smooth = true) => {
      const el = shell.current;
      const target = paneEl(p);
      if (!el || !target) return;
      const left = target.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
      slide(el, left, smooth ? glideMs(Math.abs(left - el.scrollLeft), el.clientWidth) : 0);
    },
    [paneEl],
  );

  // opening a room (or this page) on a phone: its room, or the chats if there's no room to show
  const first = useRef(true);
  useLayoutEffect(() => {
    if (!placed || !phone) return;
    const hasRoom = !!shell.current?.querySelector(":scope > .chat-room:not(.chat-empty), :scope > .chat-room.opening");
    showPane(hasRoom ? "chat" : "rooms", !first.current);
    first.current = false;
  }, [placed, phone, pathname, showPane]);

  // a swipe moves the row (paneSwipe: quicker than the browser's own snapping)
  usePaneSwipe(shell, phone);

  // which pane is showing (the one past halfway): the bar at the bottom comes with the chats
  useEffect(() => {
    const el = shell.current;
    if (!el || !phone) return;
    const read = () => {
      const kids = [...el.children].filter((c) => c instanceof HTMLElement && c.offsetParent !== null) as HTMLElement[];
      const at = kids[Math.round(el.scrollLeft / Math.max(1, el.clientWidth))];
      const p = (Object.keys(PANE_CLASS) as ChatPane[]).find((k) => at?.classList.contains(PANE_CLASS[k])) ?? "chat";
      setPaneState(p);
      document.documentElement.dataset.chatPane = p;
    };
    read();
    el.addEventListener("scroll", read, { passive: true });
    return () => {
      el.removeEventListener("scroll", read);
      delete document.documentElement.dataset.chatPane;
    };
  }, [phone, pathname]);

  // tapping the room you're in, in the chats: back to it
  const onClick = (e: React.MouseEvent) => {
    if (!phone) return;
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>(".chat-side a[href^='/chat/']");
    if (a && new URL(a.href).pathname === pathname) showPane("chat");
  };

  return (
    <Ctx.Provider value={{ ...ui, setRail, setPeople, rooms, setRooms, confirm, phone, pane, showPane }}>
      <div ref={shell} className={`chat-shell ${inRoom ? "has-room" : ""} ${placed ? "" : "unplaced"}`} onClick={onClick}>
        {children}
      </div>
      <ContextMenuHost />
      <VoiceSettingsHost />
      {node}
    </Ctx.Provider>
  );
}
