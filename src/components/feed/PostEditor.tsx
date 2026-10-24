"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ImagePlus, Lock, Save, Users, X } from "lucide-react";
import { useT, useToast } from "@/components/app/AppProvider";
import { RichEditor, type EditorHandle } from "@/components/editor/Editor";
import { uploadFile } from "@/components/ui/ui";
import { ImageLinkButton } from "@/components/ui/ImageLink";
import type { PostView } from "@/lib/contentTypes";
import { updatePostAction } from "@/app/actions/content";

/** Editing a post on a page of its own (room to work, also on a phone). */
export function PostEditor({ post }: { post: PostView }) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const ed = useRef<EditorHandle>(null);
  const [title, setTitle] = useState(post.title);
  const [cover, setCover] = useState(post.cover);
  const [visibility, setVisibility] = useState(post.visibility);
  const [pending, start] = useTransition();
  const news = post.kind === "news";
  const save = () => {
    if (ed.current?.busy()) {
      toast(t("Wait for the pictures to finish uploading."));
      return;
    }
    start(async () => {
      const r = await updatePostAction(post.id, { html: ed.current?.getHTML() ?? "", title, cover, visibility });
      if (!r.ok) {
        toast(r.error, { kind: "err" });
        return;
      }
      toast(t("Saved."));
      router.push(`/posts/${post.id}`);
      router.refresh();
    });
  };
  return (
    <div className="stack">
      <input className="input composer-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t(news ? "Headline" : "Title (optional)")} maxLength={140} />
      {news ? (
        <div className="row wrap">
          {cover ? (
            <span className="cover-preview" style={{ backgroundImage: `url("${cover}")` }}>
              <button type="button" className="icon-btn xs" onClick={() => setCover(null)} aria-label={t("Remove the cover")}>
                <X size={14} />
              </button>
            </span>
          ) : null}
          <label className="btn btn-sm">
            <ImagePlus size={15} /> {t(cover ? "Change cover" : "Cover picture")}
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
          <ImageLinkButton kind="cover" onImage={setCover} />
        </div>
      ) : null}
      <RichEditor ref={ed} initial={post.html} minHeight={260} onSubmit={save} autoFocus previews />
      <div className="composer-bar">
        {!news && !post.group ? (
          <label className="composer-to">
            {visibility === "private" ? <Lock size={15} /> : <Users size={15} />}
            <select className="select" value={visibility} onChange={(e) => setVisibility(e.target.value as "members" | "private")} aria-label={t("Who sees it")}>
              <option value="members">{t("Everyone")}</option>
              <option value="private">{t("Only me")}</option>
            </select>
          </label>
        ) : null}
        <span className="spacer" />
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
          {t("Cancel")}
        </button>
        <button type="button" className={`btn btn-primary ${pending ? "loading" : ""}`} onClick={save}>
          <Save size={16} /> {t("Save")}
        </button>
      </div>
    </div>
  );
}
