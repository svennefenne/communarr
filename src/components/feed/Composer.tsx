"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarPlus, ImagePlus, Lock, Megaphone, MessagesSquare, Send, Type, Users, Vote, X } from "lucide-react";
import { useApp, useT, useToast } from "@/components/app/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { RichEditor, type EditorHandle } from "@/components/editor/Editor";
import { uploadFile } from "@/components/ui/ui";
import { ImageLinkButton } from "@/components/ui/ImageLink";
import { createPostAction } from "@/app/actions/content";

export interface ComposerGroup {
  id: number;
  name: string;
}

/** "What's on your mind?": write a post (or, for moderators, news) right on the front page. */
export function Composer({ groups, groupId, onPosted }: { groups: ComposerGroup[]; groupId?: number; onPosted?: () => void }) {
  const { me, site } = useApp();
  const t = useT();
  const toast = useToast();
  const ed = useRef<EditorHandle>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [showTitle, setShowTitle] = useState(false);
  const [to, setTo] = useState<string>(groupId ? `g:${groupId}` : "all");
  const [news, setNews] = useState(false);
  const [cover, setCover] = useState<string | null>(null);
  const [notifyAll, setNotifyAll] = useState(true);
  const [pending, start] = useTransition();
  const expand = () => setOpen(true);
  // pictures picked before the editor is open wait for it
  const waiting = useRef<File[]>([]);
  useEffect(() => {
    if (!open || !waiting.current.length) return;
    const timer = setInterval(() => {
      if (ed.current?.editor) {
        ed.current.addFiles(waiting.current);
        waiting.current = [];
        clearInterval(timer);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [open]);
  if (!me) return null;
  const first = me.name.split(" ")[0];
  const reset = () => {
    ed.current?.clear();
    setTitle("");
    setShowTitle(false);
    setNews(false);
    setCover(null);
    setOpen(false);
  };
  const submit = () => {
    const html = ed.current?.getHTML() ?? "";
    if (ed.current?.busy()) {
      toast(t("Wait for the pictures to finish uploading."));
      return;
    }
    if (!html) {
      toast(t("Write something first."), { kind: "err" });
      return;
    }
    start(async () => {
      const r = await createPostAction({
        html,
        title: news || showTitle ? title : "",
        kind: news ? "news" : "post",
        groupId: to.startsWith("g:") ? Number(to.slice(2)) : null,
        visibility: to === "me" ? "private" : "members",
        cover: news ? cover : null,
        notifyAll,
      });
      if (!r.ok) {
        toast(r.error, { kind: "err" });
        return;
      }
      toast(t(news ? "News is out: everyone's been told." : to === "me" ? "Saved for your eyes only (under My stuff)." : "Posted!"));
      reset();
      onPosted?.();
    });
  };

  if (!open)
    return (
      <div className="panel composer closed">
        <Avatar user={me} size={42} />
        <button type="button" className="composer-fake" onClick={() => expand()}>
          {t("What's on your mind, {name}?", { name: first })}
        </button>
        <div className="composer-quick">
          <label className="icon-btn" title={t("Post a picture")} aria-label={t("Post a picture")}>
            <ImagePlus size={20} />
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                waiting.current = [...(e.target.files ?? [])];
                e.target.value = "";
                if (waiting.current.length) expand();
              }}
            />
          </label>
          {site.features.polls && site.can.polls ? (
            <Link href={`/polls/new${groupId ? `?group=${groupId}` : ""}`} className="icon-btn" title={t("Start a poll")} aria-label={t("Start a poll")}>
              <Vote size={20} />
            </Link>
          ) : null}
          {site.features.calendar && site.can.events ? (
            <Link href={`/events/new${groupId ? `?group=${groupId}` : ""}`} className="icon-btn" title={t("Plan an event")} aria-label={t("Plan an event")}>
              <CalendarPlus size={20} />
            </Link>
          ) : null}
          {site.features.forum && !groupId ? (
            <Link href="/forum/new" className="icon-btn" title={t("Start a forum thread")} aria-label={t("Start a forum thread")}>
              <MessagesSquare size={20} />
            </Link>
          ) : null}
        </div>
      </div>
    );

  return (
    <div className={`panel composer ${news ? "is-news" : ""}`}>
      <div className="composer-top">
        <Avatar user={me} size={36} />
        <b className="grow">{t(news ? "Write news for everyone" : "New post")}</b>
        {site.can.news && !groupId ? (
          <button type="button" className={`pill ${news ? "active" : ""}`} onClick={() => setNews((n) => !n)} title={t("Post as news: a headline, a cover picture and a notification for everyone")}>
            <Megaphone size={13} /> {t("News")}
          </button>
        ) : null}
        <button type="button" className="icon-btn sm" aria-label={t("Close")} title={t("Close (your text is kept as a draft)")} onClick={() => setOpen(false)}>
          <X size={18} />
        </button>
      </div>
      {news || showTitle ? (
        <input className="input composer-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t(news ? "Headline" : "Title (optional)")} maxLength={140} autoFocus={news} />
      ) : null}
      {news ? (
        <div className="row wrap" style={{ marginBottom: 10 }}>
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
          <label className="check small">
            <input type="checkbox" checked={notifyAll} onChange={(e) => setNotifyAll(e.target.checked)} /> {t("Notify everyone")}
          </label>
        </div>
      ) : null}
      <RichEditor ref={ed} variant="full" placeholder={news ? t("What's new?") : t("What's on your mind, {name}?", { name: first })} autoFocus={!news} draftKey={groupId ? `post-g${groupId}` : "post"} minHeight={140} onSubmit={submit} />
      <div className="composer-bar">
        {!news ? (
          <button type="button" className={`btn btn-ghost btn-sm ${showTitle ? "on" : ""}`} onClick={() => setShowTitle((s) => !s)}>
            <Type size={15} /> {t("Title")}
          </button>
        ) : null}
        <span className="spacer" />
        {!news ? (
          <label className="composer-to">
            {to === "me" ? <Lock size={15} /> : <Users size={15} />}
            <select className="select" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t("Who sees it")}>
              {!groupId ? <option value="all">{t("Everyone")}</option> : null}
              {groups.map((g) => (
                <option key={g.id} value={`g:${g.id}`}>
                  {g.name}
                </option>
              ))}
              {!groupId ? <option value="me">{t("Only me")}</option> : null}
            </select>
          </label>
        ) : null}
        <button type="button" className={`btn btn-primary ${pending ? "loading" : ""}`} onClick={submit} title={t("Post (Ctrl+Enter)")}>
          <Send size={16} /> {news ? t("Publish") : t("Post{verb}", { verb: "" })}
        </button>
      </div>
    </div>
  );
}
