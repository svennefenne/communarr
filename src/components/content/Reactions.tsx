"use client";

import { useRef, useState } from "react";
import { SmilePlus } from "lucide-react";
import type { Reaction } from "@/lib/types";
import { EmojiPopover, QUICK_REACTIONS } from "@/components/ui/EmojiPicker";
import { Popover } from "@/components/ui/Popover";
import { useToast } from "@/components/app/AppProvider";
import { reactAction } from "@/app/actions/content";
import type { ReactTarget } from "@/lib/reactions";

/** Apply a reaction locally right away (the server's answer replaces it). */
export function applyReaction(list: Reaction[], emoji: string, myName: string): Reaction[] {
  const i = list.findIndex((r) => r.emoji === emoji);
  if (i < 0) return [...list, { emoji, count: 1, mine: true, users: [myName] }];
  const r = list[i];
  const next = r.mine ? { ...r, count: r.count - 1, mine: false, users: r.users.filter((u) => u !== myName) } : { ...r, count: r.count + 1, mine: true, users: [...r.users, myName] };
  return next.count ? list.map((x, j) => (j === i ? next : x)) : list.filter((_, j) => j !== i);
}

/** The emoji under something: tap one to add yours, the smiley for more. */
export function Reactions({ type, id, initial, myName, onReact, small = false, react }: { type: ReactTarget | "message"; id: number; initial: Reaction[]; myName: string; onReact?: (list: Reaction[]) => void; small?: boolean; react?: (emoji: string) => Promise<Reaction[] | null> }) {
  const [list, setList] = useState(initial);
  const [quick, setQuick] = useState(false);
  const [full, setFull] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const toast = useToast();
  // the parent may hand over a fresher list (live updates)
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    setList(initial);
  }
  const toggle = async (emoji: string) => {
    const optimistic = applyReaction(list, emoji, myName);
    setList(optimistic);
    onReact?.(optimistic);
    const res = react ? await react(emoji) : await reactAction(type as ReactTarget, id, emoji).then((r) => (r.ok ? r.data : (toast(r.error, { kind: "err" }), null)));
    if (res) {
      setList(res);
      onReact?.(res);
    }
  };
  return (
    <div className={`reactions ${small ? "small" : ""}`}>
      {list.map((r) => (
        <button key={r.emoji} type="button" className={`react-chip ${r.mine ? "mine" : ""}`} onClick={() => toggle(r.emoji)} title={`${r.users.join(", ")}${r.count > r.users.length ? ` and ${r.count - r.users.length} more` : ""}`}>
          <span className="react-emoji">{r.emoji}</span>
          <span className="react-n">{r.count}</span>
        </button>
      ))}
      <button ref={btn} type="button" className="react-add" aria-label="Add a reaction" title="Add a reaction" onClick={() => setQuick((q) => !q)}>
        <SmilePlus size={small ? 15 : 17} />
      </button>
      {quick ? (
        <Popover anchor={btn.current} onClose={() => setQuick(false)}>
          <div className="quick-reacts">
            {QUICK_REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setQuick(false);
                  void toggle(e);
                }}
              >
                {e}
              </button>
            ))}
            <button
              type="button"
              className="more"
              aria-label="More emoji"
              onClick={() => {
                setQuick(false);
                setFull(true);
              }}
            >
              +
            </button>
          </div>
        </Popover>
      ) : null}
      {full ? (
        <EmojiPopover
          anchor={btn.current}
          onPick={(e) => {
            setFull(false);
            void toggle(e);
          }}
          onClose={() => setFull(false)}
        />
      ) : null}
    </div>
  );
}
