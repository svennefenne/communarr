"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /chat: straight into the default room (Admin → Groups & chat rooms), on a phone too, where the
 * room is the pane the chat opens on (the chats are a swipe to the left).
 */
export function OpenDefaultRoom({ id }: { id: number }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/chat/${id}`);
  }, [id, router]);
  return null;
}
