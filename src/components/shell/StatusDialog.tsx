"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Smile } from "lucide-react";
import { Modal } from "@/components/ui/ui";
import { EmojiPopover } from "@/components/ui/EmojiPicker";
import { setStatusAction } from "@/app/actions/me";
import type { Me } from "@/lib/bootTypes";
import type { Presence } from "@/lib/types";

const PRESETS: [string, string][] = [
  ["🎮", "Gaming"],
  ["🍕", "Out for food"],
  ["💼", "At work"],
  ["🤒", "Feeling sick"],
  ["🏖️", "On holiday"],
  ["🎧", "Headphones on"],
  ["😴", "Sleeping"],
  ["🚗", "On the road"],
];

export const PRESENCE_LABEL: Record<Presence, [string, string]> = {
  auto: ["Online", "Away when you've been gone a while"],
  away: ["Away", "Shown as away"],
  busy: ["Do not disturb", "Shown as busy"],
  invisible: ["Invisible", "Shown as offline"],
};

/** Set your status line (emoji and words, cleared after a while) and how you show up. */
export function StatusDialog({ me, onClose }: { me: Me; onClose: () => void }) {
  const [emoji, setEmoji] = useState(me.statusEmoji);
  const [text, setText] = useState(me.statusText);
  const [clear, setClear] = useState("never");
  const [presence, setPresence] = useState<Presence>(me.presence);
  const [picker, setPicker] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const save = (e: string, t: string) =>
    start(async () => {
      await setStatusAction({ emoji: e, text: t, clear, presence });
      router.refresh();
      onClose();
    });
  return (
    <Modal
      title="Your status"
      onClose={onClose}
      footer={
        <>
          {me.statusText || me.statusEmoji ? (
            <button type="button" className="btn btn-ghost" onClick={() => save("", "")} disabled={pending}>
              Clear status
            </button>
          ) : null}
          <button type="button" className={`btn btn-primary ${pending ? "loading" : ""}`} onClick={() => save(emoji, text)}>
            Save
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="input-group">
          <button type="button" ref={btn} className="icon-btn framed" style={{ width: 46, height: 46, fontSize: 22 }} onClick={() => setPicker((p) => !p)} aria-label="Pick an emoji">
            {emoji || <Smile size={20} />}
          </button>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={100} placeholder="What's up?" onKeyDown={(e) => e.key === "Enter" && save(emoji, text)} />
        </div>
        {picker ? (
          <EmojiPopover
            anchor={btn.current}
            onPick={(e) => {
              setEmoji(e);
              setPicker(false);
            }}
            onClose={() => setPicker(false)}
          />
        ) : null}
        <div className="chip-row" style={{ flexWrap: "wrap" }}>
          {PRESETS.map(([e, t]) => (
            <button
              key={t}
              type="button"
              className="pill soft"
              onClick={() => {
                setEmoji(e);
                setText(t);
              }}
            >
              {e} {t}
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="st-clear">Clear after</label>
          <select id="st-clear" className="select" value={clear} onChange={(e) => setClear(e.target.value)}>
            <option value="never">Don&apos;t clear</option>
            <option value="30m">30 minutes</option>
            <option value="1h">1 hour</option>
            <option value="4h">4 hours</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
          </select>
        </div>
        <div className="field">
          <span className="label">Show me as</span>
          <div className="stack tight">
            {(Object.keys(PRESENCE_LABEL) as Presence[]).map((p) => (
              <label key={p} className="check">
                <input type="radio" name="presence" checked={presence === p} onChange={() => setPresence(p)} />
                <span>
                  <b>{PRESENCE_LABEL[p][0]}</b> <span className="muted small">· {PRESENCE_LABEL[p][1]}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
