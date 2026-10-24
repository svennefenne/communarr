"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { CircleHelp, ImagePlus, LoaderCircle, Type } from "lucide-react";
import { buildExtensions } from "./extensions";
import { Toolbar } from "./Toolbar";
import { ImageBubble, LinkBubble, LinkDialog, PictureDialog, TextBubble, VideoDialog } from "./Menus";
import { mentionOpen } from "./mentionState";
import { importImage, uploadFile, Modal } from "@/components/ui/ui";
import { useT, useToast } from "@/components/app/AppProvider";
import { LinkPreviews } from "@/components/content/LinkPreviews";

export interface EditorHandle {
  getHTML: () => string;
  isEmpty: () => boolean;
  clear: () => void;
  focus: () => void;
  setHTML: (html: string) => void;
  insertText: (text: string) => void;
  /** pictures still uploading */
  busy: () => boolean;
  /** open the picture picker */
  pickImage: () => void;
  /** upload pictures and put them in the text */
  addFiles: (files: File[]) => void;
  editor: Editor | null;
}

export interface EditorProps {
  /** the form field the HTML goes into */
  name?: string;
  initial?: string;
  variant?: "full" | "compact";
  placeholder?: string;
  onChange?: (html: string) => void;
  /** Ctrl+Enter (and Enter in chat on a computer) */
  onSubmit?: () => void;
  enterSends?: boolean;
  autoFocus?: boolean;
  minHeight?: number;
  /** keep what's written in this browser until it's sent */
  draftKey?: string;
  limit?: number;
  /** compact: open with the formatting bar showing */
  showToolbar?: boolean;
  /** compact: buttons at the right end of the bottom bar (Send) */
  actions?: React.ReactNode;
  className?: string;
  label?: string;
  onFocus?: () => void;
  /** cards for the links under the editor as they're written (a moment after typing stops) */
  previews?: boolean;
}

const SHORTCUTS: [string, string][] = [
  ["Bold", "Ctrl + B"],
  ["Italic", "Ctrl + I"],
  ["Underline", "Ctrl + U"],
  ["Link", "Ctrl + K"],
  ["Undo / redo", "Ctrl + Z / Ctrl + Shift + Z"],
  ["Heading", "# , ## or ### and a space"],
  ["Bulleted list", "- and a space"],
  ["Numbered list", "1. and a space"],
  ["Checklist", "[ ] and a space"],
  ["Block quote", "> and a space"],
  ["Code", "`code` or ``` for a block"],
  ["Divider", "---"],
  ["Mention someone", "@ and a name"],
  ["Send / post", "Ctrl + Enter"],
];

const imageNode = (src: string, alt: string) => ({ type: "image", attrs: { src, alt: alt.slice(0, 120) } });

/** A picture's name from its link ("summer-party.jpg" → "summer party"). */
function altFrom(url: string) {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ");
  } catch {
    return "";
  }
}

function readDraft(key?: string) {
  if (!key) return "";
  try {
    return localStorage.getItem(`hd.draft.${key}`) || "";
  } catch {
    return "";
  }
}
function writeDraft(key: string, html: string) {
  try {
    if (html && html !== "<p></p>") localStorage.setItem(`hd.draft.${key}`, html);
    else localStorage.removeItem(`hd.draft.${key}`);
  } catch {
    /* private mode */
  }
}

export const RichEditor = forwardRef<EditorHandle, EditorProps>(function RichEditor(
  { name, initial = "", variant = "full", placeholder: placeholderProp, onChange, onSubmit, enterSends = false, autoFocus = false, minHeight, draftKey, limit, showToolbar, actions, className = "", label, onFocus, previews = false },
  ref,
) {
  const compact = variant === "compact";
  const t = useT();
  const placeholder = placeholderProp ?? t("Write something…");
  const toast = useToast();
  const [html, setHtml] = useState(initial);
  // the text as it was a moment ago (at once when it's emptied), for its links' cards (previews)
  const [settled, setSettled] = useState(initial);
  useEffect(() => {
    const later = setTimeout(() => setSettled(html), html ? 700 : 0);
    return () => clearTimeout(later);
  }, [html]);
  const [uploading, setUploading] = useState(0);
  const [fetching, setFetching] = useState(0);
  const fetchingRef = useRef(0);
  const [picture, setPicture] = useState(false);
  const [link, setLink] = useState(false);
  const [video, setVideo] = useState(false);
  const [help, setHelp] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [toolbar, setToolbar] = useState(!compact || !!showToolbar);
  const [restored, setRestored] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const uploadingRef = useRef(0);
  const editorRef = useRef<Editor | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const upload = useCallback(
    async (files: File[], at?: number) => {
      const pics = files.filter((f) => f.type.startsWith("image/"));
      if (!pics.length) return;
      uploadingRef.current += pics.length;
      setUploading(uploadingRef.current);
      let pos = at;
      for (const f of pics) {
        try {
          const up = await uploadFile(f, "image");
          const ed = editorRef.current;
          if (!ed) continue;
          const node = { type: "image", attrs: { src: up.url, alt: f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").slice(0, 120) } };
          if (pos !== undefined) {
            ed.chain().focus().insertContentAt(pos, node).run();
            pos = undefined;
          } else ed.chain().focus().insertContent(node).run();
        } catch (e) {
          toast(e instanceof Error ? e.message : t("The upload didn't work."), { kind: "err" });
        } finally {
          uploadingRef.current -= 1;
          setUploading(uploadingRef.current);
        }
      }
    },
    [toast, t],
  );

  // pictures from links: the site fetches them and keeps a copy
  const counting = useCallback(async <T,>(work: () => Promise<T>): Promise<T> => {
    fetchingRef.current += 1;
    setFetching(fetchingRef.current);
    try {
      return await work();
    } finally {
      fetchingRef.current -= 1;
      setFetching(fetchingRef.current);
    }
  }, []);

  /** The picture button's link: the picture (or a page's own picture) where the cursor is; an error, or null. */
  const fromLink = useCallback(
    async (url: string, at?: number): Promise<string | null> => {
      try {
        const up = await counting(() => importImage(url, "image"));
        const ed = editorRef.current;
        if (up && ed) {
          if (at !== undefined) ed.chain().focus().insertContentAt(at, imageNode(up.url, altFrom(url))).run();
          else ed.chain().focus().insertContent(imageNode(up.url, altFrom(url))).run();
        }
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : t("That picture couldn't be fetched.");
      }
    },
    [counting, t],
  );

  /** A pasted link that turns out to be a picture becomes the picture (a link to a page stays a link). */
  const pastedLink = useCallback(
    (url: string) => {
      const ed = editorRef.current;
      if (!ed) return;
      // where the pasted link ends, followed through whatever is typed meanwhile
      let end = ed.state.selection.from;
      let gone = false;
      const follow = ({ transaction }: { transaction: Transaction }) => {
        const r = transaction.mapping.mapResult(end, -1);
        end = r.pos;
        if (r.deleted) gone = true;
      };
      ed.on("transaction", follow);
      void counting(() => importImage(url, "image", true))
        .then((up) => {
          if (!up || gone || ed.isDestroyed) return;
          let from = end - url.length;
          let to = end;
          if (from < 0 || ed.state.doc.textBetween(from, to) !== url) return;
          const $from = ed.state.doc.resolve(from);
          // a link on a line of its own: the whole line becomes the picture
          if ($from.parent.isTextblock && $from.parent.textContent.trim() === url) {
            from = $from.before();
            to = $from.after();
          }
          ed.chain().insertContentAt({ from, to }, imageNode(up.url, altFrom(url))).run();
        })
        .catch(() => {
          /* it stays a link */
        })
        .finally(() => ed.off("transaction", follow));
    },
    [counting],
  );
  // (the editor's paste and drop handlers are made once; these keep them current)
  const pastedRef = useRef(pastedLink);
  pastedRef.current = pastedLink;
  const fromLinkRef = useRef(fromLink);
  fromLinkRef.current = fromLink;

  const extensions = useMemo(() => {
    const keys = Extension.create({
      name: "hoodenKeys",
      priority: 1000,
      addKeyboardShortcuts() {
        return {
          "Mod-Enter": () => {
            submitRef.current?.();
            return !!submitRef.current;
          },
          Enter: ({ editor }) => {
            if (!enterSends || mentionOpen.current) return false;
            // phones: the return key makes a new line; the send button sends
            if (window.matchMedia("(pointer: coarse)").matches) return false;
            if (editor.isActive("codeBlock") || editor.isActive("listItem") || editor.isActive("taskItem")) return false;
            submitRef.current?.();
            return true;
          },
          "Mod-k": () => {
            setLink(true);
            return true;
          },
        };
      },
    });
    return [...buildExtensions({ placeholder, compact, limit }), keys];
  }, [placeholder, compact, limit, enterSends]);

  const editor = useEditor({
    extensions,
    content: initial || "",
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: { class: "prose ed-content", ...(label ? { "aria-label": label } : {}), spellcheck: "true" },
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])];
        if (files.some((f) => f.type.startsWith("image/"))) {
          event.preventDefault();
          void upload(files);
          return true;
        }
        // a link on its own goes in as a link; once it's in, see if it's a picture
        const text = event.clipboardData?.getData("text/plain") ?? "";
        if (/^https?:\/\/\S+$/i.test(text) && text.length < 2000) setTimeout(() => pastedRef.current(text), 0);
        return false;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        const files = [...(event.dataTransfer?.files ?? [])];
        if (files.some((f) => f.type.startsWith("image/"))) {
          event.preventDefault();
          void upload(files, at);
          return true;
        }
        // a picture dragged here from another web page
        const src = /<img[^>]+src=["']([^"']+)["']/i.exec(event.dataTransfer?.getData("text/html") ?? "")?.[1]?.replace(/&amp;/g, "&");
        if (!src || !/^https?:\/\//i.test(src)) return false;
        event.preventDefault();
        void fromLinkRef.current(src, at).then((problem) => problem && toast(problem, { kind: "err" }));
        return true;
      },
    },
    onUpdate: ({ editor: e }) => {
      const h = e.isEmpty ? "" : e.getHTML();
      setHtml(h);
      changeRef.current?.(h);
      if (draftKey) {
        clearTimeout(draftTimer.current);
        draftTimer.current = setTimeout(() => writeDraft(draftKey, h), 400);
      }
    },
    onFocus: () => onFocus?.(),
  });
  editorRef.current = editor;

  // a draft left from last time
  useEffect(() => {
    if (!editor || !draftKey || initial) return;
    const d = readDraft(draftKey);
    if (d) {
      editor.commands.setContent(d, { emitUpdate: false });
      setHtml(d);
      changeRef.current?.(d);
      setRestored(true);
    }
  }, [editor, draftKey, initial]);

  // full screen: Escape leaves it, the page behind doesn't scroll
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector(".modal-back") && setExpanded(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  useImperativeHandle(
    ref,
    () => ({
      getHTML: () => (editor && !editor.isEmpty ? editor.getHTML() : ""),
      isEmpty: () => !editor || editor.isEmpty,
      clear: () => {
        editor?.commands.clearContent(true);
        setHtml("");
        setRestored(false);
        if (draftKey) writeDraft(draftKey, "");
      },
      focus: () => editor?.commands.focus("end"),
      setHTML: (h: string) => {
        editor?.commands.setContent(h, { emitUpdate: true });
      },
      insertText: (text: string) => {
        editor?.chain().focus().insertContent(text).run();
      },
      busy: () => uploadingRef.current > 0 || fetchingRef.current > 0,
      pickImage: () => fileInput.current?.click(),
      addFiles: (files: File[]) => void upload(files),
      editor,
    }),
    [editor, draftKey, upload],
  );

  const words = useEditorState({ editor, selector: ({ editor: e }) => (e ? (e.storage.characterCount?.words?.() as number) ?? 0 : 0) });

  return (
    <>
      <div className={`editor ${compact ? "compact" : "full"} ${expanded ? "ed-full" : ""} ${className}`} style={minHeight ? ({ ["--ed-min" as string]: `${minHeight}px` } as React.CSSProperties) : undefined}>
        {name ? <input type="hidden" name={name} value={html} /> : null}
        {editor && toolbar ? (
          <Toolbar editor={editor} compact={compact} expanded={expanded} onExpand={() => setExpanded((x) => !x)} onImage={() => setPicture(true)} onLink={() => setLink(true)} onVideo={() => setVideo(true)} />
        ) : null}
        <div className="ed-body" onClick={(e) => e.target === e.currentTarget && editor?.commands.focus("end")}>
          {editor ? <EditorContent editor={editor} /> : <div className="prose ed-content ed-loading" dangerouslySetInnerHTML={{ __html: initial || `<p class="faint">${placeholder}</p>` }} />}
        </div>
        {editor ? (
          <>
            <TextBubble editor={editor} onLink={() => setLink(true)} />
            <LinkBubble editor={editor} onEdit={() => setLink(true)} />
            <ImageBubble editor={editor} />
          </>
        ) : null}
        <div className="ed-foot">
          {compact ? (
            <>
              <button type="button" className={`tb-btn ${toolbar ? "on" : ""}`} title={t("Formatting")} aria-label={t("Formatting")} aria-pressed={toolbar} onMouseDown={(e) => e.preventDefault()} onClick={() => setToolbar((x) => !x)}>
                <Type size={17} />
              </button>
              <button type="button" className="tb-btn" title={t("Add a picture")} aria-label={t("Add a picture")} onMouseDown={(e) => e.preventDefault()} onClick={() => setPicture(true)}>
                <ImagePlus size={17} />
              </button>
            </>
          ) : null}
          <span className="ed-status">
            {uploading ? (
              <span className="row" style={{ gap: 6 }}>
                <LoaderCircle size={14} className="spin" /> {t.n(uploading, "Uploading {n} picture…", "Uploading {n} pictures…")}
              </span>
            ) : fetching ? (
              <span className="row" style={{ gap: 6 }}>
                <LoaderCircle size={14} className="spin" /> {t("Fetching the picture from the link…")}
              </span>
            ) : restored ? (
              <span>
                {t("Draft restored")} ·{" "}
                <button
                  type="button"
                  className="link"
                  style={{ background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit" }}
                  onClick={() => {
                    editor?.commands.clearContent(true);
                    setRestored(false);
                    if (draftKey) writeDraft(draftKey, "");
                  }}
                >
                  {t("discard")}
                </button>
              </span>
            ) : !compact ? (
              <span>{words ? t.n(words, "{n} word", "{n} words") : t("Drop or paste pictures anywhere")}</span>
            ) : null}
          </span>
          {!compact ? (
            <button type="button" className="tb-btn" title={t("Shortcuts")} aria-label={t("Keyboard shortcuts")} onClick={() => setHelp(true)}>
              <CircleHelp size={16} />
            </button>
          ) : null}
          {actions}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            void upload(files);
          }}
        />
        {picture ? <PictureDialog onPick={() => fileInput.current?.click()} onLink={(url) => fromLink(url)} onClose={() => setPicture(false)} /> : null}
        {link && editor ? <LinkDialog editor={editor} onClose={() => setLink(false)} /> : null}
        {video && editor ? <VideoDialog editor={editor} onClose={() => setVideo(false)} /> : null}
        {help ? (
          <Modal title={t("Writing tips")} onClose={() => setHelp(false)}>
            <p className="muted small" style={{ marginTop: 0 }}>
              {t("Everything is in the bar above the text. Select words for quick formatting, and drop, paste or pick pictures (then drag their corner to resize). These shortcuts work too:")}
            </p>
            <div className="list inset">
              {SHORTCUTS.map(([a, b]) => (
                <div key={a} className="list-row" style={{ padding: "8px 12px" }}>
                  <span className="grow">{t(a)}</span>
                  <span className="mono small muted">{t(b)}</span>
                </div>
              ))}
            </div>
          </Modal>
        ) : null}
      </div>
      {previews ? <LinkPreviews html={settled} /> : null}
    </>
  );
});
