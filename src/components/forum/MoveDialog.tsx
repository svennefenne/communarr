"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useT, useToast } from "@/components/app/AppProvider";
import { Modal } from "@/components/ui/ui";
import { Time } from "@/components/ui/Time";
import { findThreadsAction, mergeThreadAction, moderateThreadAction, moveReplyAction } from "@/app/actions/content";

type Found = { id: number; title: string; category: string; replies: number; lastPostAt: number };

/**
 * Moderators move forum posts. A reply: to another thread (one of the latest, or found by words in
 * its title), or out into a thread of its own, with a title, in a category. A whole thread: to another
 * category, or into another thread (its first post and its replies go in among that one's).
 */
export function MoveDialog({
  thread,
  reply,
  categories,
  onClose,
}: {
  thread: { id: number; title: string; categoryId: number };
  reply?: { id: number; text: string };
  categories: { id: number; name: string; icon: string }[];
  onClose: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [mode, setMode] = useState<"thread" | "new" | "category">(reply ? "thread" : "category");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [pick, setPick] = useState<Found | null>(null);
  const [cat, setCat] = useState(thread.categoryId);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== "thread") return;
    let on = true;
    const timer = setTimeout(
      () =>
        void findThreadsAction(q, thread.id).then((r) => {
          if (on && r.ok) setFound(r.data);
        }),
      q ? 200 : 0,
    );
    return () => {
      on = false;
      clearTimeout(timer);
    };
  }, [mode, q, thread.id]);

  const ready = mode === "thread" ? !!pick : mode === "new" ? !!title.trim() : cat !== thread.categoryId;
  const go = async () => {
    if (!ready || busy) return;
    setBusy(true);
    const catName = categories.find((c) => c.id === cat)?.name ?? "";
    if (reply) {
      const r = await moveReplyAction(reply.id, mode === "thread" && pick ? { threadId: pick.id } : { categoryId: cat, title });
      setBusy(false);
      if (!r.ok) return toast(r.error, { kind: "err" });
      toast(mode === "thread" ? t("Moved to “{title}”.", { title: pick?.title ?? "" }) : t("Moved out into a thread of its own: “{title}”.", { title: title.trim() }), { href: mode === "thread" ? `/go/reply/${reply.id}` : `/forum/t/${r.data}` });
      onClose();
      router.refresh();
    } else if (mode === "thread" && pick) {
      const r = await mergeThreadAction(thread.id, pick.id);
      setBusy(false);
      if (!r.ok) return toast(r.error, { kind: "err" });
      toast(t("Moved into “{title}”.", { title: pick.title }));
      router.push(`/forum/t/${r.data}`);
    } else {
      const r = await moderateThreadAction(thread.id, { categoryId: cat });
      setBusy(false);
      if (!r.ok) return toast(r.error, { kind: "err" });
      toast(t("Moved to {category}.", { category: catName }));
      onClose();
      router.refresh();
    }
  };

  const modes = reply
    ? ([
        ["thread", t("To another thread")],
        ["new", t("As a new thread")],
      ] as const)
    : ([
        ["category", t("To another category")],
        ["thread", t("Into another thread")],
      ] as const);
  return (
    <Modal
      title={reply ? t("Move the reply") : t("Move the thread")}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className={`btn btn-primary ${busy ? "loading" : ""}`} disabled={!ready} onClick={() => void go()}>
            {t("Move")}
          </button>
        </>
      }
    >
      <div className="stack">
        {reply ? <blockquote className="move-what small muted clamp-2">{reply.text}</blockquote> : <p className="move-what small muted">“{thread.title}”</p>}
        <div className="pills" role="radiogroup" aria-label={t("Where to")} style={{ alignSelf: "flex-start" }}>
          {modes.map(([m, label]) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} className={`pill ${mode === m ? "active" : ""}`} onClick={() => setMode(m)}>
              {label}
            </button>
          ))}
        </div>

        {mode === "thread" ? (
          <>
            <div className="chat-search move-search">
              <Search size={15} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Find a thread")} aria-label={t("Find a thread")} autoFocus />
            </div>
            <div className="move-list" role="listbox" aria-label={t("Threads")}>
              {(found ?? []).map((f) => (
                <button key={f.id} type="button" role="option" aria-selected={pick?.id === f.id} className={`list-row ${pick?.id === f.id ? "on" : ""}`} onClick={() => setPick(f)}>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <b className="ellipsis" style={{ display: "block" }}>
                      {f.title}
                    </b>
                    <span className="tiny muted">
                      {f.category} · {t.n(f.replies, "{n} reply", "{n} replies")} · <Time t={f.lastPostAt} />
                    </span>
                  </span>
                </button>
              ))}
              {found && !found.length ? <p className="small muted" style={{ margin: 0, padding: "10px 12px" }}>{q.trim() ? t("No thread's title has those words.") : t("There's no other thread yet.")}</p> : null}
            </div>
            <p className="hint" style={{ margin: 0 }}>
              {reply ? t("It goes in among that thread's replies, by when it was written.") : t("Its first post and every reply go in among that thread's, by when they were written. This thread is then gone.")}
            </p>
          </>
        ) : null}

        {mode === "new" ? (
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="mv-title">{t("Title")}</label>
            <input id="mv-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder={t("What the new thread is about")} autoFocus />
          </div>
        ) : null}

        {mode === "new" || mode === "category" ? (
          <div className="move-list" role="radiogroup" aria-label={t("Category")}>
            {categories.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={cat === c.id} className={`list-row ${cat === c.id ? "on" : ""}`} onClick={() => setCat(c.id)}>
                <span>{c.icon}</span>
                <span className="grow">{c.name}</span>
                {mode === "category" && c.id === thread.categoryId ? <span className="tiny muted">{t("Here now")}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
