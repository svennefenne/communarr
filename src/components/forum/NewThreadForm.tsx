"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { FilePen, FileText, Send } from "lucide-react";
import type { DraftSummary } from "@/lib/types";
import { useT, useToast } from "@/components/app/AppProvider";
import { RichEditor, type EditorHandle } from "@/components/editor/Editor";
import { useConfirm } from "@/components/ui/ui";
import { DraftList, useDrafts } from "@/components/feed/Drafts";
import { createThreadAction, deleteDraftAction, draftAction, saveDraftAction } from "@/app/actions/content";

/**
 * A new forum thread: its category, title and first post. What's written can be saved as a draft
 * (lib/drafts.ts, kind "thread") and opened again here later, on any device: "Drafts" lists them, to
 * open or delete.
 */
export function NewThreadForm({ cats, initialCat, showDrafts: listFirst = false }: { cats: { id: number; name: string; icon: string; locked: boolean }[]; initialCat?: number; showDrafts?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const ed = useRef<EditorHandle>(null);
  const [cat, setCat] = useState(initialCat ?? cats[0]?.id);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  // drafts: theirs, the one that's open here, and whether the list shows
  const { drafts, reload } = useDrafts("thread");
  const [draftId, setDraftId] = useState<number | null>(null);
  const [showDrafts, setShowDrafts] = useState(listFirst);
  const { confirm, node } = useConfirm();
  const mine = drafts ?? [];
  const where = (d: DraftSummary) => {
    const c = cats.find((x) => `c:${x.id}` === d.target);
    return c ? `${c.icon} ${c.name}` : t("Forum");
  };

  const submit = () => {
    if (ed.current?.busy()) {
      toast(t("Wait for the pictures to finish uploading."));
      return;
    }
    start(async () => {
      const r = await createThreadAction({ categoryId: Number(cat), title, html: ed.current?.getHTML() ?? "" }, draftId ?? undefined);
      if (!r.ok) {
        toast(r.error, { kind: "err" });
        return;
      }
      ed.current?.clear();
      router.push(`/forum/t/${r.data}`);
    });
  };
  const saveDraft = () => {
    const html = ed.current?.getHTML() ?? "";
    if (ed.current?.busy()) {
      toast(t("Wait for the pictures to finish uploading."));
      return;
    }
    if (!html && !title.trim()) {
      toast(t("Write something first."), { kind: "err" });
      return;
    }
    start(async () => {
      const r = await saveDraftAction(draftId, { kind: "thread", title, html, target: `c:${cat}` });
      if (!r.ok) {
        toast(r.error, { kind: "err" });
        return;
      }
      toast(t("Saved as a draft."));
      ed.current?.clear();
      setTitle("");
      setDraftId(null);
      void reload();
    });
  };
  const openDraft = (id: number) => {
    const go = async () => {
      const r = await draftAction(id);
      if (!r.ok || !r.data) {
        toast(r.ok ? t("That draft is gone.") : r.error, { kind: "err" });
        void reload();
        return;
      }
      const d = r.data;
      // (its category, if they may still start a thread there)
      const c = cats.find((x) => `c:${x.id}` === d.target);
      if (c) setCat(c.id);
      setTitle(d.title);
      ed.current?.setHTML(d.html);
      setDraftId(d.id);
      setShowDrafts(false);
    };
    const written = !!title.trim() || !(ed.current?.isEmpty() ?? true);
    if (written && draftId !== id) confirm(t("Replace what you've written with the draft?"), t("Replace"), go);
    else void go();
  };
  const removeDraft = (id: number) =>
    confirm(t("Delete the draft?"), t("Delete"), async () => {
      const r = await deleteDraftAction(id);
      if (!r.ok) {
        toast(r.error, { kind: "err" });
        return;
      }
      if (id === draftId) setDraftId(null);
      toast(t("Draft deleted."));
      void reload();
    });

  return (
    <div className="stack">
      {mine.length || showDrafts ? (
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className={`pill ${showDrafts ? "active" : ""}`} onClick={() => setShowDrafts((x) => !x)} aria-expanded={showDrafts}>
            <FileText size={13} /> {t("Drafts")} · {mine.length}
          </button>
        </div>
      ) : null}
      {showDrafts ? <DraftList drafts={mine} current={draftId} where={where} onOpen={openDraft} onDelete={removeDraft} /> : null}
      <div className="grid-2" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)" }}>
        <div className="field">
          <label htmlFor="nt-cat">{t("Category")}</label>
          <select id="nt-cat" className="select" value={cat} onChange={(e) => setCat(Number(e.target.value))}>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="nt-title">{t("Title")}</label>
          <input id="nt-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder={t("What's it about?")} autoFocus />
        </div>
      </div>
      <RichEditor ref={ed} placeholder={t("Say what's on your mind. Pictures, links, lists and tables all work.")} minHeight={240} draftKey="thread" onSubmit={submit} previews />
      <div className="row wrap" style={{ justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
          {t("Cancel")}
        </button>
        <button type="button" className="btn btn-ghost" onClick={saveDraft} disabled={pending} title={t("Keep it to post later, on any of your devices")}>
          <FilePen size={15} /> {draftId ? t("Save the draft") : t("Save draft")}
        </button>
        <button type="button" className={`btn btn-primary ${pending ? "loading" : ""}`} onClick={submit}>
          <Send size={16} /> {t("Start the thread")}
        </button>
      </div>
      {node}
    </div>
  );
}
