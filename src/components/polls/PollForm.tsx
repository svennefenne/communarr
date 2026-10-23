"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Send, Trash2 } from "lucide-react";
import { useT, useToast } from "@/components/app/AppProvider";
import { RichEditor, type EditorHandle } from "@/components/editor/Editor";
import type { PollView } from "@/lib/contentTypes";
import { createPollAction, updatePollAction } from "@/app/actions/content";

/** A Date as the value of an <input type="datetime-local"> (local time). */
export function toLocalInput(t: number | null | undefined) {
  if (!t) return "";
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const QUICK_CLOSE: [string, number][] = [
  ["in 1 hour", 3600_000],
  ["in 1 day", 86_400_000],
  ["in 3 days", 3 * 86_400_000],
  ["in 1 week", 7 * 86_400_000],
];

export function PollForm({ groups, poll, groupId }: { groups: { id: number; name: string }[]; poll?: PollView; groupId?: number }) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const ed = useRef<EditorHandle>(null);
  const [question, setQuestion] = useState(poll?.question ?? "");
  const [options, setOptions] = useState<string[]>(poll ? poll.options.map((o) => o.label) : ["", ""]);
  const [multiple, setMultiple] = useState(poll?.multiple ?? false);
  const [max, setMax] = useState(poll?.maxChoices ?? 0);
  const [anonymous, setAnonymous] = useState(poll?.anonymous ?? false);
  const [allowChange, setAllowChange] = useState(poll?.allowChange ?? true);
  const [allowAdd, setAllowAdd] = useState(poll?.allowAdd ?? false);
  const [results, setResults] = useState<PollView["results"]>(poll?.results ?? "always");
  const [closes, setCloses] = useState(toLocalInput(poll?.closesAt));
  const [group, setGroup] = useState<number | "">(poll?.group?.id ?? groupId ?? "");
  const [pending, start] = useTransition();
  const lockedOptions = new Set(poll?.options.filter((o) => o.votes > 0).map((o) => o.label));

  const setOpt = (i: number, v: string) => setOptions((o) => o.map((x, j) => (j === i ? v : x)));
  const move = (i: number, d: number) =>
    setOptions((o) => {
      const n = [...o];
      const j = i + d;
      if (j < 0 || j >= n.length) return o;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const submit = () =>
    start(async () => {
      const input = {
        question,
        html: ed.current?.getHTML() ?? "",
        options: options.filter((o) => o.trim()),
        multiple,
        maxChoices: multiple && max > 1 ? max : null,
        anonymous,
        allowChange,
        allowAdd,
        results,
        closesAt: closes ? new Date(closes).getTime() : null,
        groupId: group || null,
      };
      const r = poll ? await updatePollAction(poll.id, input) : await createPollAction(input);
      if (!r.ok) {
        toast(r.error, { kind: "err" });
        return;
      }
      ed.current?.clear();
      router.push(`/polls/${poll ? poll.id : r.data}`);
      router.refresh();
    });

  return (
    <div className="stack loose">
      <div className="field">
        <label htmlFor="pf-q">{t("Question")}</label>
        <input id="pf-q" className="input" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} placeholder={t("Pizza or tacos on Friday?")} autoFocus={!poll} style={{ fontSize: "1.1rem", fontWeight: 700 }} />
      </div>
      <div className="field">
        <span className="label">{t("More about it (optional)")}</span>
        <RichEditor ref={ed} variant="compact" showToolbar initial={poll?.html} placeholder={t("Details, links, pictures…")} minHeight={70} draftKey={poll ? undefined : "poll"} />
      </div>
      <div className="field">
        <span className="label">{t("Choices")}</span>
        <div className="stack tight">
          {options.map((o, i) => (
            <div key={i} className="poll-edit-row">
              <span className="poll-edit-n mono">{i + 1}</span>
              <input
                className="input"
                value={o}
                onChange={(e) => setOpt(i, e.target.value)}
                maxLength={120}
                placeholder={t("Choice {n}", { n: i + 1 })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (i === options.length - 1) setOptions((x) => [...x, ""]);
                    setTimeout(() => (document.querySelectorAll<HTMLInputElement>(".poll-edit-row input")[i + 1] as HTMLInputElement | undefined)?.focus(), 30);
                  }
                }}
              />
              <button type="button" className="icon-btn sm" onClick={() => move(i, -1)} disabled={!i} aria-label={t("Up")}>
                <ArrowUp size={15} />
              </button>
              <button type="button" className="icon-btn sm" onClick={() => move(i, 1)} disabled={i === options.length - 1} aria-label={t("Down")}>
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                className="icon-btn sm"
                onClick={() => setOptions((x) => x.filter((_, j) => j !== i))}
                disabled={options.length <= 2 || lockedOptions.has(o)}
                aria-label={t("Remove")}
                title={t(lockedOptions.has(o) ? "People voted for this one" : "Remove")}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {options.length < 30 ? (
            <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setOptions((x) => [...x, ""])}>
              <Plus size={15} /> {t("Add a choice")}
            </button>
          ) : null}
        </div>
      </div>
      <div className="grid-2">
        <div className="stack tight">
          <span className="label">{t("Voting")}</span>
          <label className="check">
            <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} /> {t("People can pick more than one")}
          </label>
          {multiple ? (
            <label className="row small" style={{ paddingLeft: 27 }}>
              {t("At most")}
              <input type="number" className="input sm" style={{ width: 80 }} min={0} max={30} value={max || ""} onChange={(e) => setMax(Number(e.target.value))} placeholder={t("any")} />
            </label>
          ) : null}
          <label className="check">
            <input type="checkbox" checked={allowChange} onChange={(e) => setAllowChange(e.target.checked)} /> {t("People can change their vote")}
          </label>
          <label className="check">
            <input type="checkbox" checked={allowAdd} onChange={(e) => setAllowAdd(e.target.checked)} /> {t("Anyone can add choices")}
          </label>
          <label className="check">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} disabled={poll?.anonymous} /> {t("Anonymous: nobody sees who voted for what")}
          </label>
        </div>
        <div className="stack tight">
          <div className="field">
            <label htmlFor="pf-results">{t("Show the results")}</label>
            <select id="pf-results" className="select" value={results} onChange={(e) => setResults(e.target.value as PollView["results"])}>
              <option value="always">{t("All the time")}</option>
              <option value="after_vote">{t("Once you've voted")}</option>
              <option value="after_close">{t("When the poll closes")}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="pf-close">{t("Closes (optional)")}</label>
            <input id="pf-close" type="datetime-local" className="input" value={closes} onChange={(e) => setCloses(e.target.value)} />
            <div className="chip-row">
              {QUICK_CLOSE.map(([l, ms]) => (
                <button key={l} type="button" className="pill soft" onClick={() => setCloses(toLocalInput(Date.now() + ms))}>
                  {t(l)}
                </button>
              ))}
              {closes ? (
                <button type="button" className="pill soft" onClick={() => setCloses("")}>
                  {t("never")}
                </button>
              ) : null}
            </div>
          </div>
          {!poll && groups.length ? (
            <div className="field">
              <label htmlFor="pf-group">{t("Where")}</label>
              <select id="pf-group" className="select" value={group} onChange={(e) => setGroup(e.target.value ? Number(e.target.value) : "")}>
                <option value="">{t("Everyone")}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </div>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
          {t("Cancel")}
        </button>
        <button type="button" className={`btn btn-primary ${pending ? "loading" : ""}`} onClick={submit}>
          <Send size={16} /> {t(poll ? "Save" : "Ask")}
        </button>
      </div>
    </div>
  );
}
