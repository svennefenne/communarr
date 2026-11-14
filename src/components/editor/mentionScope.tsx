"use client";

import { createContext, useContext, useMemo } from "react";
import type { MentionTier } from "@/lib/mentionOrder";

const Ctx = createContext<MentionTier[]>([]);

/**
 * The people of the place inside it (a chat's members, a group's, a conversation's): the @ list in any
 * editor inside offers them first, under `label` ("In the chat"). Inside another, its people come
 * first and the outer one's next.
 */
export function MentionScope({ ids, label, children }: { ids: number[]; label: string; children: React.ReactNode }) {
  const outer = useContext(Ctx);
  const key = ids.join(",");
  // (the same people: the same list, however often the ids are made anew)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => [{ ids, label }, ...outer], [key, label, outer]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The places an editor is in, the innermost first (none: an empty list). */
export const useMentionScope = () => useContext(Ctx);
