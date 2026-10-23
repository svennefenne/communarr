"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ImagePlus, Send, X } from "lucide-react";
import { useT, useToast } from "@/components/app/AppProvider";
import { RichEditor, type EditorHandle } from "@/components/editor/Editor";
import { uploadFile } from "@/components/ui/ui";
import type { EventView } from "@/lib/contentTypes";
import { createEventAction, updateEventAction } from "@/app/actions/content";

const COLORS = ["#d65a2b", "#e2a634", "#2f7088", "#4f8f50", "#9c5bb5", "#d4689a", "#5b7bd6", "#c8412f"];

const pad = (n: number) => String(n).padStart(2, "0");
const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function initialStart(date?: string): Date {
  const d = date ? new Date(`${date}T18:00`) : new Date();
  if (!date) {
    d.setDate(d.getDate() + 1);
    d.setHours(18, 0, 0, 0);
  }
  return d;
}

export function EventForm({ groups, event, date, groupId }: { groups: { id: number; name: string }[]; event?: EventView; date?: string; groupId?: number }) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const ed = useRef<EditorHandle>(null);
  const s0 = event ? new Date(event.startAt) : initialStart(date);
  const e0 = event ? new Date(event.endAt) : new Date(s0.getTime() + 2 * 3600_000);
  const [title, setTitle] = useState(event?.title ?? "");
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [sd, setSd] = useState(dateStr(s0));
  const [st, setSt] = useState(timeStr(s0));
  const [edd, setEdd] = useState(dateStr(e0));
  const [et, setEt] = useState(timeStr(e0));
  const [location, setLocation] = useState(event?.location ?? "");
  const [color, setColor] = useState(event?.color ?? COLORS[0]);
  const [cover, setCover] = useState<string | null>(event?.cover ?? null);
  const [repeat, setRepeat] = useState<EventView["repeat"]>(event?.repeat ?? "none");
  const [until, setUntil] = useState(event?.repeatUntil ? dateStr(new Date(event.repeatUntil)) : "");
  const [capacity, setCapacity] = useState(event?.capacity ? String(event.capacity) : "");
  const [group, setGroup] = useState<number | "">(event?.group?.id ?? groupId ?? "");
  const [pending, start] = useTransition();

  // moving the start moves the end with it
  const setStartDate = (v: string) => {
    const len = new Date(`${edd}T${et}`).getTime() - new Date(`${sd}T${st}`).getTime();
    setSd(v);
    const ne = new Date(new Date(`${v}T${st}`).getTime() + Math.max(0, len));
    if (!Number.isNaN(ne.getTime())) {
      setEdd(dateStr(ne));
      setEt(timeStr(ne));
    }
  };
  const setStartTime = (v: string) => {
    const len = new Date(`${edd}T${et}`).getTime() - new Date(`${sd}T${st}`).getTime();
    setSt(v);
    const ne = new Date(new Date(`${sd}T${v}`).getTime() + Math.max(0, len));
    if (!Number.isNaN(ne.getTime())) {
      setEdd(dateStr(ne));
      setEt(timeStr(ne));
    }
  };

  const submit = () => {
    if (ed.current?.busy()) {
      toast(t("Wait for the pictures to finish uploading."));
      return;
    }
    const startAt = allDay ? new Date(`${sd}T00:00`).getTime() : new Date(`${sd}T${st}`).getTime();
    const endAt = allDay ? new Date(`${edd}T23:59:59`).getTime() : new Date(`${edd}T${et}`).getTime();
    if (endAt < startAt) {
      toast(t("It ends before it starts."), { kind: "err" });
      return;
    }
    start(async () => {
      const input = {
        title,
        html: ed.current?.getHTML() ?? "",
        location,
        startAt,
        endAt,
        allDay,
        color,
        cover,
        repeat,
        repeatUntil: repeat !== "none" && until ? new Date(`${until}T23:59:59`).getTime() : null,
        capacity: capacity ? Number(capacity) : null,
        groupId: group || null,
      };
      const r = event ? await updateEventAction(event.id, input) : await createEventAction(input);
      if (!r.ok) {
        toast(r.error, { kind: "err" });
        return;
      }
      ed.current?.clear();
      router.push(`/events/${event ? event.id : r.data}`);
      router.refresh();
    });
  };

  return (
    <div className="stack loose">
      <div className="field">
        <label htmlFor="ef-title">{t("What")}</label>
        <input id="ef-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder={t("Game night at mine")} autoFocus={!event} style={{ fontSize: "1.1rem", fontWeight: 700 }} />
      </div>
      <div className="panel-pad-sm inset stack">
        <label className="check">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> {t("All day")}
        </label>
        <div className="grid-2">
          <div className="field">
            <label>{t("Starts")}</label>
            <div className="input-group">
              <input type="date" className="input" value={sd} onChange={(e) => setStartDate(e.target.value)} />
              {!allDay ? <input type="time" className="input" value={st} onChange={(e) => setStartTime(e.target.value)} style={{ maxWidth: 140 }} /> : null}
            </div>
          </div>
          <div className="field">
            <label>{t("Ends")}</label>
            <div className="input-group">
              <input type="date" className="input" value={edd} min={sd} onChange={(e) => setEdd(e.target.value)} />
              {!allDay ? <input type="time" className="input" value={et} onChange={(e) => setEt(e.target.value)} style={{ maxWidth: 140 }} /> : null}
            </div>
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="ef-repeat">{t("Repeats")}</label>
            <select id="ef-repeat" className="select" value={repeat} onChange={(e) => setRepeat(e.target.value as EventView["repeat"])}>
              <option value="none">{t("Doesn't repeat")}</option>
              <option value="daily">{t("Every day")}</option>
              <option value="weekly">{t("Every week")}</option>
              <option value="monthly">{t("Every month")}</option>
              <option value="yearly">{t("Every year")}</option>
            </select>
          </div>
          {repeat !== "none" ? (
            <div className="field">
              <label htmlFor="ef-until">{t("Until (optional)")}</label>
              <input id="ef-until" type="date" className="input" value={until} min={sd} onChange={(e) => setUntil(e.target.value)} />
            </div>
          ) : null}
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="ef-where">{t("Where")}</label>
          <input id="ef-where" className="input" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} placeholder={t("An address, a place, or a link")} />
        </div>
        <div className="field">
          <label htmlFor="ef-cap">{t("How many can come (optional)")}</label>
          <input id="ef-cap" type="number" min={1} className="input" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder={t("No limit")} />
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <span className="label">{t("Colour in the calendar")}</span>
          <div className="swatches">
            {COLORS.map((c) => (
              <button key={c} type="button" className={`swatch ${color === c ? "on" : ""}`} style={{ background: c, width: 32, height: 32 }} onClick={() => setColor(c)} aria-label={c} />
            ))}
          </div>
        </div>
        <div className="field">
          <span className="label">{t("Picture (optional)")}</span>
          <div className="row wrap">
            {cover ? (
              <span className="cover-preview" style={{ backgroundImage: `url("${cover}")` }}>
                <button type="button" className="icon-btn xs" onClick={() => setCover(null)} aria-label={t("Remove the picture")}>
                  <X size={14} />
                </button>
              </span>
            ) : null}
            <label className="btn btn-sm">
              <ImagePlus size={15} /> {cover ? t("Change") : t("Add a picture")}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  try {
                    setCover((await uploadFile(f, "cover")).url);
                  } catch (err) {
                    toast(err instanceof Error ? err.message : t("The upload didn't work."), { kind: "err" });
                  }
                }}
              />
            </label>
          </div>
        </div>
      </div>
      <div className="field">
        <span className="label">{t("Details")}</span>
        <RichEditor ref={ed} initial={event?.html} placeholder={t("What to bring, what's the plan… @mention people to invite them.")} minHeight={150} draftKey={event ? undefined : "event"} />
      </div>
      {!event && groups.length ? (
        <div className="field">
          <label htmlFor="ef-group">{t("For")}</label>
          <select id="ef-group" className="select" value={group} onChange={(e) => setGroup(e.target.value ? Number(e.target.value) : "")}>
            <option value="">{t("Everyone")}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
          {t("Cancel")}
        </button>
        <button type="button" className={`btn btn-primary ${pending ? "loading" : ""}`} onClick={submit}>
          <Send size={16} /> {event ? t("Save") : t("Plan it")}
        </button>
      </div>
    </div>
  );
}
