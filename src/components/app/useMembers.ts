"use client";

import { useEffect, useState } from "react";
import type { UserSummary } from "@/lib/types";
import { loadMembers } from "@/components/editor/mention";

/** Everyone, by id (fetched once per page). */
export function useMembers(): Map<number, UserSummary> {
  const [map, setMap] = useState<Map<number, UserSummary>>(new Map());
  useEffect(() => {
    let live = true;
    loadMembers().then((list) => live && setMap(new Map(list.map((u) => [u.id, u]))));
    return () => {
      live = false;
    };
  }, []);
  return map;
}
