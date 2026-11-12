"use client";

import { useEffect, useState } from "react";
import { useApp, useLive, useT } from "@/components/app/AppProvider";

/** Someone typing in a room: who, and until when (a few seconds after the last sign of it). */
export type Typer = { id: number; name: string; until: number };

/**
 * Who's typing where, room by room (Discord's "Anna is typing…", Messenger's dots): from the live
 * typing events (someone typing sends one every three seconds), each for a few seconds after the last,
 * and gone as soon as their message comes. Never you.
 */
export function useTyping(): Map<number, Typer[]> {
  const { me } = useApp();
  const [rooms, setRooms] = useState<Map<number, Typer[]>>(new Map());
  useLive("typing", (d) => {
    const e = d as { room: number; user: { id: number; name: string } };
    if (e.user.id === me?.id) return;
    setRooms((m) => new Map(m).set(e.room, [...(m.get(e.room) ?? []).filter((x) => x.id !== e.user.id), { id: e.user.id, name: e.user.name, until: Date.now() + 4500 }]));
  });
  useLive("msg", (d) => {
    const { room, message } = d as { room: number; message: { author: { id: number } | null } };
    const who = message.author?.id;
    setRooms((m) => {
      const list = m.get(room);
      if (who == null || !list?.some((x) => x.id === who)) return m;
      const n = new Map(m);
      const left = list.filter((x) => x.id !== who);
      if (left.length) n.set(room, left);
      else n.delete(room);
      return n;
    });
  });
  // gone quiet: no longer typing
  const any = rooms.size > 0;
  useEffect(() => {
    if (!any) return;
    const id = setInterval(
      () =>
        setRooms((m) => {
          const now = Date.now();
          const n = new Map<number, Typer[]>();
          for (const [r, list] of m) {
            const left = list.filter((x) => x.until > now);
            if (left.length) n.set(r, left);
          }
          return [...n.values()].flat().length === [...m.values()].flat().length ? m : n;
        }),
      1000,
    );
    return () => clearInterval(id);
  }, [any]);
  return rooms;
}

/** Three dots that bounce in turn. */
export function TypingDots({ className = "typing-dots" }: { className?: string }) {
  return (
    <span className={className} aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

/** "Anna is typing…" with the names in bold (first names, three at most), after the dots. */
export function TypingLine({ typers }: { typers: Typer[] }) {
  const t = useT();
  const names = typers.slice(0, 3).map((x) => x.name.split(" ")[0]).join(", ");
  const [before, after] = t.n(typers.length, "{names} is typing…", "{names} are typing…", { names: "\u0000" }).split("\u0000");
  return (
    <>
      <TypingDots />
      <span>
        {before}
        <b>{names}</b>
        {after}
      </span>
    </>
  );
}
