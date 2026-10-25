"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import type { UserSummary } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { mentionOpen } from "./mentionState";
import { useT } from "@/components/app/AppProvider";

/** Everyone, fetched once per page for @mentions. */
let members: Promise<UserSummary[]> | null = null;
export function loadMembers(): Promise<UserSummary[]> {
  if (!members)
    members = fetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => {
        members = null;
        return [];
      });
  return members;
}

interface Item {
  id: string;
  label: string;
  user: UserSummary;
}

interface ListHandle {
  onKeyDown: (e: KeyboardEvent) => boolean;
}

const MentionList = forwardRef<ListHandle, SuggestionProps<Item>>(function MentionList(props, ref) {
  const t = useT();
  const [sel, setSel] = useState(0);
  useEffect(() => setSel(0), [props.items]);
  const pick = (i: number) => {
    const it = props.items[i];
    if (it) props.command({ id: it.id, label: it.label });
  };
  useImperativeHandle(ref, () => ({
    onKeyDown: (e) => {
      if (e.key === "ArrowUp") {
        setSel((s) => (s + props.items.length - 1) % Math.max(1, props.items.length));
        return true;
      }
      if (e.key === "ArrowDown") {
        setSel((s) => (s + 1) % Math.max(1, props.items.length));
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        pick(sel);
        return true;
      }
      return false;
    },
  }));
  if (!props.items.length) return <div className="panel mention-list muted small" style={{ padding: "10px 12px" }}>{t("No one by that name")}</div>;
  return (
    <div className="panel mention-list" role="listbox">
      {props.items.map((it, i) => (
        <button key={it.id} type="button" role="option" aria-selected={i === sel} className={`menu-item ${i === sel ? "sel" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(i)}>
          <Avatar user={it.user} size={24} />
          <span className="ellipsis">{it.label}</span>
          <span className="muted small">@{it.id}</span>
        </button>
      ))}
    </div>
  );
});

export function place(el: HTMLElement, rect: DOMRect | null | undefined) {
  if (!rect) return;
  const w = el.offsetWidth || 260;
  const h = el.offsetHeight || 200;
  let top = rect.bottom + 6;
  if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 6);
  el.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, rect.left))}px`;
  el.style.top = `${top}px`;
}

export const mentionSuggestion: Omit<SuggestionOptions<Item>, "editor"> = {
  char: "@",
  items: async ({ query }) => {
    const q = query.toLowerCase();
    const list = await loadMembers();
    return list
      .filter((u) => !q || u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
      .sort((a, b) => Number(!a.username.toLowerCase().startsWith(q)) - Number(!b.username.toLowerCase().startsWith(q)))
      .slice(0, 8)
      .map((u) => ({ id: u.username, label: u.name, user: u }));
  },
  render: () => {
    let renderer: ReactRenderer<ListHandle, SuggestionProps<Item>> | null = null;
    let box: HTMLDivElement | null = null;
    return {
      onStart: (props) => {
        mentionOpen.current = true;
        renderer = new ReactRenderer(MentionList, { props, editor: props.editor });
        box = document.createElement("div");
        box.className = "mention-pop";
        box.appendChild(renderer.element);
        document.body.appendChild(box);
        requestAnimationFrame(() => box && place(box, props.clientRect?.()));
      },
      onUpdate: (props) => {
        renderer?.updateProps(props);
        if (box) place(box, props.clientRect?.());
      },
      onKeyDown: (props) => {
        if (props.event.key === "Escape") {
          box?.remove();
          return true;
        }
        return renderer?.ref?.onKeyDown(props.event) ?? false;
      },
      onExit: () => {
        mentionOpen.current = false;
        box?.remove();
        renderer?.destroy();
        box = null;
        renderer = null;
      },
    };
  },
};
