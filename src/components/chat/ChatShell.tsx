"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { CHAT_UI_COOKIE, type ChatUi } from "@/lib/chatTypes";


const Ctx = createContext<ChatUi & { setRail: (on: boolean) => void; setPeople: (on: boolean) => void }>({ rail: false, people: true, setRail: () => {}, setPeople: () => {} });
export const useChatUi = () => useContext(Ctx);

/**
 * Chats side by side with the open room (and the room's members beside it on a wide screen); on a
 * phone one at a time. How it's laid out is kept on this device, in a cookie, so the server draws it
 * that way from the start.
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
  return (
    <Ctx.Provider value={{ ...ui, setRail, setPeople }}>
      <div className={`chat-shell ${inRoom ? "has-room" : ""}`}>{children}</div>
    </Ctx.Provider>
  );
}
