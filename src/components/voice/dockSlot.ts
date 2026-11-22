"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * The voice dock steps aside while the call's controls are on the page already: the chat list's voice
 * panel, or the voice bar at the top of the room you're talking in.
 */
let shown = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

/** While `on`: this page shows the call's controls itself. */
export function useCallControlsHere(on: boolean) {
  useEffect(() => {
    if (!on) return;
    shown++;
    emit();
    return () => {
      shown--;
      emit();
    };
  }, [on]);
}

export function useCallControlsElsewhere() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => shown > 0,
    () => false,
  );
}
