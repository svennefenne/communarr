"use client";

import { useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { byPlace, type RoomInfo } from "@/lib/chatTypes";
import { useT, useToast } from "@/components/app/AppProvider";
import { arrangeRoomsAction } from "@/app/actions/chat";
import { RoomIcon } from "./ChatSidebar";

/**
 * Admins: the order of the rooms in everyone's chat list, and of the groups' own chats under them
 * (each in its own part, as the list shows them). Drag a room by its handle, or move it with the
 * arrows (phones, keyboards); Done saves it. Direct messages aren't in it (newest first, always).
 */
export function ArrangeRooms({ rooms, onDone }: { rooms: RoomInfo[]; onDone: (saved: boolean) => void }) {
  const t = useT();
  const toast = useToast();
  const [lists, setLists] = useState(() => [rooms.filter((r) => r.kind !== "group").sort(byPlace), rooms.filter((r) => r.kind === "group").sort(byPlace)]);
  const [pending, start] = useTransition();
  const move = (part: number, from: number, to: number) =>
    setLists((ls) => {
      const l = ls[part];
      if (to < 0 || to >= l.length || from === to) return ls;
      const next = [...l];
      const [r] = next.splice(from, 1);
      next.splice(to, 0, r);
      return ls.map((x, i) => (i === part ? next : x));
    });
  return (
    <div className="arrange">
      <div className="chat-side-head">
        <h1 className="h2">{t("Arrange the rooms")}</h1>
      </div>
      <p className="small muted arrange-hint">{t("The order everyone sees the rooms in. Drag them by the handle, or use the arrows. Direct messages stay newest first.")}</p>
      <div className="chat-side-scroll">
        {lists.map((list, part) =>
          list.length ? (
            <section key={part} aria-label={part ? t("Groups") : t("Rooms")}>
              <div className="menu-label chat-section">{part ? t("Groups") : t("Rooms")}</div>
              <Part list={list} move={(from, to) => move(part, from, to)} />
            </section>
          ) : null,
        )}
      </div>
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
              const r = await arrangeRoomsAction(lists.flat().map((x) => x.id));
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

/** One part of the list (the rooms, or the groups' chats): a room is dragged within its own part. */
function Part({ list, move }: { list: RoomInfo[]; move: (from: number, to: number) => void }) {
  const t = useT();
  const [dragging, setDragging] = useState<number | null>(null);
  const over = useRef<number | null>(null);
  return (
    <ol className="arrange-list">
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
            if (dragging === null) return;
            e.preventDefault();
            if (over.current !== i) {
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
  );
}
