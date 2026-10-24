"use client";

import { useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import type { RoomInfo } from "@/lib/chatTypes";
import { useT, useToast } from "@/components/app/AppProvider";
import { arrangeRoomsAction } from "@/app/actions/chat";
import { RoomIcon } from "./ChatSidebar";

/**
 * Admins: the order of the rooms in everyone's chat list. Drag a room by its handle, or move it with
 * the arrows (phones, keyboards); Done saves it. Direct messages aren't in it (newest first, always).
 */
export function ArrangeRooms({ rooms, onDone }: { rooms: RoomInfo[]; onDone: (saved: boolean) => void }) {
  const t = useT();
  const toast = useToast();
  const [list, setList] = useState(rooms);
  const [dragging, setDragging] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const over = useRef<number | null>(null);
  const move = (from: number, to: number) =>
    setList((l) => {
      if (to < 0 || to >= l.length || from === to) return l;
      const next = [...l];
      const [r] = next.splice(from, 1);
      next.splice(to, 0, r);
      return next;
    });
  return (
    <div className="arrange">
      <div className="chat-side-head">
        <h1 className="h2">{t("Arrange the rooms")}</h1>
      </div>
      <p className="small muted arrange-hint">{t("The order everyone sees the rooms in. Drag them by the handle, or use the arrows. Direct messages stay newest first.")}</p>
      <ol className="arrange-list chat-side-scroll">
        {list.map((r, i) => (
          <li
            key={r.id}
            className={`chat-row arrange-row ${dragging === r.id ? "dragging" : ""}`}
            draggable
            onDragStart={(e) => {
              setDragging(r.id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", String(r.id));
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (over.current !== i && dragging !== null) {
                over.current = i;
                move(
                  list.findIndex((x) => x.id === dragging),
                  i,
                );
              }
            }}
            onDragEnd={() => {
              setDragging(null);
              over.current = null;
            }}
          >
            <GripVertical size={16} className="muted arrange-grip" aria-hidden />
            <RoomIcon r={r} size={32} />
            <b className="grow ellipsis">{r.name}</b>
            <button type="button" className="icon-btn xs" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={t("Move {name} up", { name: r.name })}>
              <ChevronUp size={15} />
            </button>
            <button type="button" className="icon-btn xs" onClick={() => move(i, i + 1)} disabled={i === list.length - 1} aria-label={t("Move {name} down", { name: r.name })}>
              <ChevronDown size={15} />
            </button>
          </li>
        ))}
      </ol>
      <div className="row arrange-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDone(false)}>
          {t("Cancel")}
        </button>
        <span className="spacer" />
        <button
          type="button"
          className={`btn btn-primary btn-sm ${pending ? "loading" : ""}`}
          onClick={() =>
            start(async () => {
              const r = await arrangeRoomsAction(list.map((x) => x.id));
              if (r.ok) {
                toast(t("The rooms are in your order now, for everyone."));
                onDone(true);
              } else toast(r.error, { kind: "err" });
            })
          }
        >
          {t("Done")}
        </button>
      </div>
    </div>
  );
}
