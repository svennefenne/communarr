"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, RotateCcw, Search } from "lucide-react";
import { useT, useToast } from "@/components/app/AppProvider";
import { LANGS, type Lang } from "@/lib/i18n";
import { saveTextAction, searchTextsAction, type TextRow } from "@/app/actions/admin";
import { ALL_PLACES } from "@/lib/textPlaces";

/** The {placeholders} in a text: where a name, a number or a title goes. */
const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

/**
 * Admin → Texts: find any built-in text (in English or Swedish) and write the site's own wording for
 * it, per language. Empty goes back to the built-in text.
 */
export function TextsEditor() {
  const t = useT();
  const [q, setQ] = useState("");
  const [changedOnly, setChangedOnly] = useState(false);
  // a page or part of the site: every text there, no search needed
  const [place, setPlace] = useState("");
  const [rows, setRows] = useState<TextRow[] | null>(null);
  const [tick, setTick] = useState(0);
  const searching = changedOnly || !!place || q.trim().length >= 2;
  useEffect(() => {
    if (!searching) return;
    let live = true;
    const id = setTimeout(async () => {
      const r = await searchTextsAction(q, changedOnly, place);
      if (live) setRows(r.ok ? r.data : []);
    }, 250);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [q, changedOnly, place, searching, tick]);
  const shown = searching ? rows : null;
  const places = [...ALL_PLACES].sort((a, b) => t(a).localeCompare(t(b), t.locale));
  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>
        {t("Write your own wording for any text on the site, in Swedish, English or both. Leave a field empty for the built-in text. Keep the {placeholders}: {name} is where a name goes.")}
      </p>
      <p className="small muted" style={{ margin: 0 }}>
        {t("What members and admins made themselves is changed where it lives: a chat room's name in its settings, forum categories above, a group's name in the group.")}
      </p>
      <div className="row wrap">
        <div className="chat-search" style={{ margin: 0, flex: "1 1 240px", maxWidth: 420 }}>
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Find a text, e.g. Hej or Good morning")} aria-label={t("Find a text")} />
        </div>
        <select className="select" value={place} onChange={(e) => setPlace(e.target.value)} aria-label={t("Where on the site")} style={{ flex: "1 1 200px", maxWidth: 300 }}>
          <option value="">{t("Everywhere on the site")}</option>
          {places.map((p) => (
            <option key={p} value={p}>
              {t(p)}
            </option>
          ))}
        </select>
        <div className="pills">
          <button type="button" className={`pill ${!changedOnly ? "active" : ""}`} aria-pressed={!changedOnly} onClick={() => setChangedOnly(false)}>
            {t("All texts")}
          </button>
          <button type="button" className={`pill ${changedOnly ? "active" : ""}`} aria-pressed={changedOnly} onClick={() => setChangedOnly(true)}>
            {t("Changed")}
          </button>
        </div>
      </div>
      {shown === null ? (
        <p className="small muted" style={{ margin: 0 }}>
          {changedOnly || place ? t("Loading…") : t("Type at least two letters to find texts, or pick a page.")}
        </p>
      ) : shown.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>
          {changedOnly ? t("You haven't changed any texts yet.") : t("No text matches that.")}
        </p>
      ) : (
        <div className="stack tight">
          {shown.map((r) => (
            <TextEdit key={r.key} row={r} onSaved={() => setTick((x) => x + 1)} onPlace={setPlace} current={place} />
          ))}
          {shown.length >= (place ? 150 : 60) ? <p className="small muted">{t("Showing the first {n}: search for more of the text.", { n: place ? 150 : 60 })}</p> : null}
        </div>
      )}
    </div>
  );
}

function TextEdit({ row, onSaved, onPlace, current }: { row: TextRow; onSaved: () => void; onPlace: (place: string) => void; current: string }) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [vals, setVals] = useState<Record<Lang, string>>(() => Object.fromEntries(LANGS.map((l) => [l.id, row.own[l.id] ?? ""])) as Record<Lang, string>);
  const [pending, start] = useTransition();
  const keyHoles = holes(row.key);
  const save = (lang: Lang, value: string) => {
    if ((row.own[lang] ?? "") === value.trim()) return;
    start(async () => {
      const r = await saveTextAction(lang, row.key, value);
      if (!r.ok) toast(r.error, { kind: "err" });
      else {
        toast(value.trim() ? t("Saved.") : t("Back to the built-in text."));
        router.refresh();
        onSaved();
      }
    });
  };
  return (
    <div className="panel panel-pad text-edit">
      {/* where it shows up: click one to see every text on that page */}
      <div className="row wrap text-places">
        <MapPin size={13} className="muted" aria-hidden />
        <span className="tiny muted">{row.places.length ? t("Shown in") : t("Not found on any page (may be unused)")}</span>
        {row.places.map((p) => (
          <button key={p} type="button" className={`chip-link ${p === current ? "on" : ""}`} onClick={() => onPlace(p)} title={t("Every text here")}>
            {t(p)}
          </button>
        ))}
      </div>
      <code className="small muted" style={{ wordBreak: "break-word", display: "block", marginTop: 6 }}>
        {row.key}
      </code>
      <div className="grid-2" style={{ marginTop: 8 }}>
        {/* your own language first */}
        {[...LANGS].sort((a, b) => Number(b.id === t.lang) - Number(a.id === t.lang)).map((l) => {
          const v = vals[l.id];
          const mine = row.own[l.id] !== undefined;
          const unknown = v ? holes(v).filter((h) => !keyHoles.includes(h)) : [];
          const left = v ? keyHoles.filter((h) => !v.includes(`{${h}}`)) : [];
          return (
            <div className="field" key={l.id} style={{ margin: 0 }}>
              <label htmlFor={`txt-${l.id}-${row.key}`}>
                {l.name}
                {mine ? <span className="badge accent" style={{ marginLeft: 6 }}>{t("your own")}</span> : null}
              </label>
              <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                <input
                  id={`txt-${l.id}-${row.key}`}
                  className="input"
                  lang={l.id}
                  value={v}
                  placeholder={row.builtIn[l.id]}
                  disabled={pending}
                  maxLength={2000}
                  onChange={(e) => setVals({ ...vals, [l.id]: e.target.value })}
                  onBlur={(e) => save(l.id, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                />
                {mine ? (
                  <button
                    type="button"
                    className="icon-btn"
                    title={t("Back to the built-in text")}
                    aria-label={t("Back to the built-in text")}
                    disabled={pending}
                    onClick={() => {
                      setVals({ ...vals, [l.id]: "" });
                      save(l.id, "");
                    }}
                  >
                    <RotateCcw size={15} />
                  </button>
                ) : null}
              </div>
              {unknown.length ? (
                <span className="small" style={{ color: "var(--err)" }}>
                  {t("Nothing fills in {list} here. This text has: {have}", { list: unknown.map((h) => `{${h}}`).join(" "), have: keyHoles.map((h) => `{${h}}`).join(" ") || "–" })}
                </span>
              ) : left.length ? (
                <span className="small muted">{t("Leaves out {list}", { list: left.map((h) => `{${h}}`).join(" ") })}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
