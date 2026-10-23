"use client";

import { usePathname } from "next/navigation";

/** Chats side by side with the open room; on a phone one at a time. */
export function ChatShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inRoom = /^\/chat\/\d+/.test(pathname);
  return <div className={`chat-shell ${inRoom ? "has-room" : ""}`}>{children}</div>;
}
