"use client";

import { useRef, useState } from "react";
import { SmilePlus } from "lucide-react";
import type { Reaction } from "@/lib/types";
import { EmojiPopover, QUICK_REACTIONS } from "@/components/ui/EmojiPicker";
import { Popover } from "@/components/ui/Popover";
import { useT, useToast } from "@/components/app/AppProvider";
import { reactAction } from "@/app/actions/content";
import type { ReactTarget } from "@/lib/reactions";
import { Emoji } from "@/components/emoji/Emojis";

/** Apply a reaction locally right away (the server's answer replaces it). */
export function applyReaction(list: Reaction[], emoji: string, myName: string): Reaction[] {
  // one reaction per person: the one you have goes either way, and another one takes its place
  const had = list.find((r) => r.mine)?.emoji;
  const without = list.map((r) => (r.mine ? { ...r, count: r.count - 1, mine: false, users: r.users.filter((u) => u !== myName) } : r)).filter((r) => r.count > 0);
  if (had === emoji) return without;
  const i = without.findIndex((r) => r.emoji === emoji);
  if (i < 0) return [...without, { emoji, count: 1, mine: true, users: [myName] }];
  return without.map((r, j) => (j === i ? { ...r, count: r.count + 1, mine: true, users: [...r.users, myName] } : r));
}

/** The emoji under something: tap one to add yours, the smiley for more. */
export function Reactions({ type, id, initial, myName, onReact, small = false, react }: { type: ReactTarget | "message"; id: number; initial: Reaction[]; myName: string; onReact?: (list: Reaction[]) => void; small?: boolean; react?: (emoji: string) => Promise<Reaction[] | null> }) {
  const [list, setList] = useState(initial);
  const [quick, setQuick] = useState(false);
  const [full, setFull] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const t = useT();
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
        <button key={r.emoji} type="button" className={`react-chip ${r.mine ? "mine" : ""}`} onClick={() => toggle(r.emoji)} title={r.count > r.users.length ? t("{names} and {n} more", { names: r.users.join(", "), n: r.count - r.users.length }) : r.users.join(", ")}>
          <span className="react-emoji">
            <Emoji e={r.emoji} />
          </span>
          <span className="react-n">{r.count}</span>
        </button>
      ))}
      <button ref={btn} type="button" className="react-add" aria-label={t("Add a reaction")} title={t("Add a reaction")} onClick={() => setQuick((q) => !q)}>
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
              aria-label={t("More emoji")}
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
          custom
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
