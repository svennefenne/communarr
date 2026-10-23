"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Smile } from "lucide-react";
import { useT } from "@/components/app/AppProvider";
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

/** (English: translated where they're shown) */
export const PRESENCE_LABEL: Record<Presence, [string, string]> = {
  auto: ["Online", "Away when you've been gone a while"],
  away: ["Away", "Shown as away"],
  busy: ["Do not disturb", "Shown as busy"],
  invisible: ["Invisible", "Shown as offline"],
};

/** Set your status line (emoji and words, cleared after a while) and how you show up. */
export function StatusDialog({ me, onClose }: { me: Me; onClose: () => void }) {
  const t = useT();
  const [emoji, setEmoji] = useState(me.statusEmoji);
  const [text, setText] = useState(me.statusText);
  const [clear, setClear] = useState("never");
  const [presence, setPresence] = useState<Presence>(me.presence);
  const [picker, setPicker] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const save = (e: string, text: string) =>
    start(async () => {
      await setStatusAction({ emoji: e, text, clear, presence });
      router.refresh();
      onClose();
    });
  return (
    <Modal
      title={t("Your status")}
      onClose={onClose}
      footer={
        <>
          {me.statusText || me.statusEmoji ? (
            <button type="button" className="btn btn-ghost" onClick={() => save("", "")} disabled={pending}>
              {t("Clear status")}
            </button>
          ) : null}
          <button type="button" className={`btn btn-primary ${pending ? "loading" : ""}`} onClick={() => save(emoji, text)}>
            {t("Save")}
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="input-group">
          <button type="button" ref={btn} className="icon-btn framed" style={{ width: 46, height: 46, fontSize: 22 }} onClick={() => setPicker((p) => !p)} aria-label={t("Pick an emoji")}>
            {emoji || <Smile size={20} />}
          </button>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={100} placeholder={t("What's up?")} onKeyDown={(e) => e.key === "Enter" && save(emoji, text)} />
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
          {PRESETS.map(([e, label]) => (
            <button
              key={label}
              type="button"
              className="pill soft"
              onClick={() => {
                setEmoji(e);
                setText(t(label));
              }}
            >
              {e} {t(label)}
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="st-clear">{t("Clear after")}</label>
          <select id="st-clear" className="select" value={clear} onChange={(e) => setClear(e.target.value)}>
            <option value="never">{t("Don't clear")}</option>
            <option value="30m">{t("30 minutes")}</option>
            <option value="1h">{t("1 hour")}</option>
            <option value="4h">{t("4 hours")}</option>
            <option value="today">{t("Today")}</option>
            <option value="week">{t("This week")}</option>
          </select>
        </div>
        <div className="field">
          <span className="label">{t("Show me as")}</span>
          <div className="stack tight">
            {(Object.keys(PRESENCE_LABEL) as Presence[]).map((p) => (
              <label key={p} className="check">
                <input type="radio" name="presence" checked={presence === p} onChange={() => setPresence(p)} />
                <span>
                  <b>{t(PRESENCE_LABEL[p][0])}</b> <span className="muted small">· {t(PRESENCE_LABEL[p][1])}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
