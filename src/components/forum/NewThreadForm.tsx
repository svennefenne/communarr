"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { useT, useToast } from "@/components/app/AppProvider";
import { RichEditor, type EditorHandle } from "@/components/editor/Editor";
import { createThreadAction } from "@/app/actions/content";

export function NewThreadForm({ cats, initialCat }: { cats: { id: number; name: string; icon: string; locked: boolean }[]; initialCat?: number }) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const ed = useRef<EditorHandle>(null);
  const [cat, setCat] = useState(initialCat ?? cats[0]?.id);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  const submit = () => {
    if (ed.current?.busy()) {
      toast(t("Wait for the pictures to finish uploading."));
      return;
    }
    start(async () => {
      const r = await createThreadAction({ categoryId: Number(cat), title, html: ed.current?.getHTML() ?? "" });
      if (!r.ok) {
        toast(r.error, { kind: "err" });
        return;
      }
      ed.current?.clear();
      router.push(`/forum/t/${r.data}`);
    });
  };
  return (
    <div className="stack">
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
      <RichEditor ref={ed} placeholder={t("Say what's on your mind. Pictures, links, lists and tables all work.")} minHeight={240} draftKey="thread" onSubmit={submit} />
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
          {t("Cancel")}
        </button>
        <button type="button" className={`btn btn-primary ${pending ? "loading" : ""}`} onClick={submit}>
          <Send size={16} /> {t("Start the thread")}
        </button>
      </div>
    </div>
  );
}
