"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import type { UserSummary } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { mentionOpen } from "./mentionState";
import { useMentionScope } from "./mentionScope";
import { orderMentions } from "@/lib/mentionOrder";
import { useApp, useT } from "@/components/app/AppProvider";

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

/**
 * The @ list: everyone (narrowed by what's typed), the people of the place being written in first (a
 * chat's, a group's: MentionScope), then whoever's online, then the rest, under a heading each.
 */
const MentionList = forwardRef<ListHandle, SuggestionProps<Item>>(function MentionList(props, ref) {
  const t = useT();
  const { presence, me } = useApp();
  const tiers = useMentionScope();
  const sections = useMemo(
    () =>
      orderMentions(
        props.items.map((it) => it.user),
        props.query,
        tiers,
        (id) => (presence.get(id) ?? "offline") !== "offline",
        me?.id,
      ),
    [props.items, props.query, tiers, presence, me?.id],
  );
  const flat = sections.flatMap((s) => s.items);
  const [sel, setSel] = useState(0);
  useEffect(() => setSel(0), [props.items, props.query]);
  const box = useRef<HTMLDivElement>(null);
  // the chosen one stays in view as the arrows go down a long list
  useEffect(() => box.current?.querySelector<HTMLElement>(".menu-item.sel")?.scrollIntoView({ block: "nearest" }), [sel]);
  const pick = (i: number) => {
    const u = flat[i];
    if (u) props.command({ id: u.username, label: u.name });
  };
  useImperativeHandle(ref, () => ({
    onKeyDown: (e) => {
      if (e.key === "ArrowUp") {
        setSel((s) => (s + flat.length - 1) % Math.max(1, flat.length));
        return true;
      }
      if (e.key === "ArrowDown") {
        setSel((s) => (s + 1) % Math.max(1, flat.length));
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        pick(sel);
        return true;
      }
      return false;
    },
  }));
  if (!flat.length) return <div className="panel mention-list muted small" style={{ padding: "10px 12px" }}>{t("No one by that name")}</div>;
  let i = 0;
  return (
    <div className="panel mention-list" role="listbox" aria-label={t("Mention someone")} ref={box}>
      {sections.map((s) => (
        <div key={s.label ?? "all"} role="group" aria-label={s.label ? t(s.label) : undefined}>
          {s.label ? (
            <div className="mention-sec" aria-hidden>
              {t(s.label)}
            </div>
          ) : null}
          {s.items.map((u) => {
            const at = i++;
            return (
              <button key={u.id} type="button" role="option" aria-selected={at === sel} className={`menu-item ${at === sel ? "sel" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(at)}>
                <Avatar user={u} size={24} presence />
                <span className="ellipsis grow">{u.name}</span>
                <span className="muted small">@{u.username}</span>
              </button>
            );
          })}
        </div>
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
    // (everyone it fits: the list puts them in order, by where they're written to)
    return list.filter((u) => !q || u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)).map((u) => ({ id: u.username, label: u.name, user: u }));
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
