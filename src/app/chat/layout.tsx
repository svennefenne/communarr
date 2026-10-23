import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { roomsFor } from "@/lib/chat";
import { getSettings } from "@/lib/settings";
import { ChatShell } from "@/components/chat/ChatShell";
import { ChatSidebar } from "@/components/chat/ChatSidebar";

export const metadata = { title: "Chat" };
export const dynamic = "force-dynamic";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  if (!getSettings().features.chat) notFound();
  return (
    <ChatShell>
      <ChatSidebar initial={roomsFor(u)} />
      {children}
    </ChatShell>
  );
}
