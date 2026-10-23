import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { dmRoom } from "@/lib/chat";
import { Empty } from "@/components/ui/ui";

export const dynamic = "force-dynamic";

export default async function ChatIndex({ searchParams }: { searchParams: Promise<{ dm?: string }> }) {
  const u = await requireUser();
  const { dm } = await searchParams;
  // /chat?dm=<member>: straight to your messages with them
  if (dm && Number(dm) && Number(dm) !== u.id) {
    let id = 0;
    try {
      id = dmRoom(u, Number(dm));
    } catch {
      /* no such member */
    }
    if (id) redirect(`/chat/${id}`);
  }
  return (
    <section className="panel chat-room chat-empty">
      <Empty icon={<MessageCircle size={26} />} title="Pick a chat">
        Choose a room or a person on the left, or start something new with the buttons at the top. Every room has a voice channel: press the headphones to talk.
      </Empty>
    </section>
  );
}
