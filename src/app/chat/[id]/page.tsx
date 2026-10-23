import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManage, canSee, members, messages, readMarks, room, roomInfo } from "@/lib/chat";
import { requestT } from "@/lib/t";
import { ChatRoom } from "@/components/chat/ChatRoom";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const r = room(Number((await params).id));
  if (!r || !canSee(u, r)) return { title: (await requestT())("Chat") };
  return { title: roomInfo(u, r).name };
}

export default async function RoomPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string }> }) {
  const u = await requireUser();
  const id = Number((await params).id);
  const { m } = await searchParams;
  const r = room(id);
  if (!r) notFound();
  const invited = !!db().prepare("select 1 from room_invites where room_id = ? and user_id = ?").get(id, u.id);
  const visible = canSee(u, r);
  if (!visible && !invited) notFound();
  const info = roomInfo(u, r);
  const me = db().prepare("select role, last_read_id from room_members where room_id = ? and user_id = ?").get(id, u.id) as { role: string; last_read_id: number } | undefined;
  const initial = visible ? messages(u, id, m ? { around: Number(m) } : {}) : { messages: [], more: false };
  return (
    <ChatRoom
      key={id}
      info={info}
      initial={initial}
      members={visible ? members(id) : []}
      reads={visible ? readMarks(id) : []}
      lastRead={me?.last_read_id ?? 0}
      canManage={canManage(u, r)}
      isOwner={me?.role === "owner"}
    />
  );
}
