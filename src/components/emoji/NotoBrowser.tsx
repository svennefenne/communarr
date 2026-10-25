"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { useT } from "@/components/app/AppProvider";
import { importImage } from "@/components/ui/ui";
import { GROUPS, loadEmoji } from "@/components/ui/emojiData";
import { NOTO_LICENSE, NOTO_PAGE } from "./Emojis";

/** [codepoint, name, the picker's group] (scripts/noto-emoji.mjs) */
type Noto = [string, string, number];

let catalogue: Promise<Noto[]> | null = null;
const loadNoto = () => (catalogue ??= import("@/lib/noto.json").then((m) => m.default as unknown as Noto[]));

/** "1f469_200d_1f4bb" → 👩‍💻 */
const glyph = (code: string) =>
  code
    .split("_")
    .map((h) => String.fromCodePoint(parseInt(h, 16)))
    .join("");
const bare = (s: string) => s.replace(/️/g, "");


/**
 * Google's animated emoji (Noto, CC BY 4.0) to pick from. They're drawn here with the device's own
 * emoji, so looking fetches nothing from Google; the one picked is fetched by the site, which keeps a
 * copy the size of an emoji (animated). onPick gets that copy and the emoji's name.
 */
export function NotoBrowser({ onPick, picked }: { onPick: (up: { url: string; name: string; code: string }) => void; picked: string | null }) {
  const t = useT();
  const [all, setAll] = useState<Noto[] | null>(null);
  const [words, setWords] = useState<Map<string, string>>(new Map());
  const [q, setQ] = useState("");
  const [group, setGroup] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  // (the last one tapped wins)
  const latest = useRef("");
  useEffect(() => {
    void loadNoto().then(setAll);
    // their names and words in the reader's language, for searching
    void loadEmoji(t.lang).then((list) => setWords(new Map(list.map((e) => [bare(e[0]), `${e[1]} ${e[3]}`.toLowerCase()]))));
  }, [t.lang]);
  const groups = useMemo(() => GROUPS.filter((g) => all?.some((n) => n[2] === g.id)), [all]);
  const shown = useMemo(() => {
    if (!all) return [];
    const s = q.trim().toLowerCase();
    if (!s) return all.filter((n) => n[2] === group);
    const under = s.replace(/[\s:]+/g, "_");
    return all.filter((n) => n[1].includes(under) || words.get(bare(glyph(n[0])))?.includes(s));
  }, [all, q, group, words]);
  const pick = async (n: Noto) => {
    latest.current = n[0];
    setBusy(n[0]);
    setErr("");
    try {
      const up = await importImage(`https://fonts.gstatic.com/s/e/notoemoji/latest/${n[0]}/512.webp`, "emoji");
      if (latest.current === n[0] && up) onPick({ url: up.url, name: n[1], code: n[0] });
    } catch (e) {
      if (latest.current === n[0]) setErr(e instanceof Error ? e.message : t("That picture couldn't be fetched."));
    } finally {
      if (latest.current === n[0]) setBusy(null);
    }
  };
  return (
    <div className="noto stack tight">
      <label className="emoji-filter">
        <Search size={15} />
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search emoji")} aria-label={t("Search Google's animated emoji")} />
      </label>
      {!q ? (
        <div className="emoji-groups noto-groups" role="tablist">
          {groups.map((g) => (
            <button key={g.id} type="button" role="tab" aria-selected={group === g.id} className={group === g.id ? "on" : ""} title={t(g.label)} aria-label={t(g.label)} onClick={() => setGroup(g.id)}>
              {g.icon}
            </button>
          ))}
        </div>
      ) : null}
      <div className="emoji-grid noto-grid">
        {!all ? <div className="muted small" style={{ gridColumn: "1/-1", padding: 12 }}>{t("Loading…")}</div> : null}
        {all && !shown.length ? <div className="muted small" style={{ gridColumn: "1/-1", padding: 12 }}>{t("No emoji found.")}</div> : null}
        {shown.map((n) => (
          <button key={n[0]} type="button" title={`:${n[1]}:`} aria-label={`:${n[1]}:`} aria-pressed={picked === n[0]} className={picked === n[0] ? "on" : undefined} disabled={busy === n[0]} onClick={() => void pick(n)}>
            {busy === n[0] ? <LoaderCircle size={18} className="spin" /> : glyph(n[0])}
          </button>
        ))}
      </div>
      {err ? <div className="form-error">{err}</div> : null}
      <p className="tiny muted" style={{ margin: 0 }}>
        <a href={NOTO_PAGE} target="_blank" rel="noopener noreferrer">
          {t("Google's animated Noto Emoji")}
        </a>{" "}
        (
        <a href={NOTO_LICENSE} target="_blank" rel="noopener noreferrer">
          CC BY 4.0
        </a>
        ). {t("Tap one to see it move: the site keeps its own copy, emoji-sized.")}
      </p>
    </div>
  );
}
