"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /chat on a computer: straight into the default room (Admin → Groups & chat rooms). On a phone the
 * list of chats is the page (a room's back button comes here), so it stays.
 */
export function OpenDefaultRoom({ id }: { id: number }) {
  const router = useRouter();
  useEffect(() => {
    if (window.matchMedia("(min-width: 700px)").matches) router.replace(`/chat/${id}`);
  }, [id, router]);
  return null;
}
