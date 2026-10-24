"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { NodeSelection } from "@tiptap/pm/state";
import { AlignCenter, AlignLeft, AlignRight, Bold, ExternalLink, Highlighter, ImagePlus, Italic, Link2, LoaderCircle, Pencil, RemoveFormatting, Strikethrough, Trash2, Underline, Unlink } from "lucide-react";
import { HIGHLIGHTS, TEXT_COLORS } from "./Toolbar";
import { Modal } from "@/components/ui/ui";
import { useT } from "@/components/app/AppProvider";

const isImage = (e: Editor) => e.state.selection instanceof NodeSelection && e.state.selection.node.type.name === "image";
const touch = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

function B({ on, label, onClick, children }: { on?: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`tb-btn ${on ? "on" : ""}`} title={label} aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}

/** Quick formatting over selected text. */
export function TextBubble({ editor, onLink }: { editor: Editor; onLink: () => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({ bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"), strike: e.isActive("strike"), link: e.isActive("link") }),
  });
  const t = useT();
  const [colors, setColors] = useState(false);
  const c = () => editor.chain().focus();
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="textBubble"
      options={{ placement: touch() ? "bottom" : "top", offset: 8 }}
      shouldShow={({ editor: e, state }) => !state.selection.empty && !isImage(e) && !e.isActive("codeBlock") && e.isEditable}
      className="panel ed-bubble"
    >
      {colors ? (
        <div className="ed-bubble-colors">
          {TEXT_COLORS.slice(0, 12).map((col) => (
            <button key={col} type="button" className="swatch" style={{ background: col }} aria-label={col} onMouseDown={(e) => e.preventDefault()} onClick={() => c().setColor(col).run()} />
          ))}
          {HIGHLIGHTS.slice(0, 5).map((col) => (
            <button key={col} type="button" className="swatch" style={{ background: col, borderRadius: 13 }} aria-label={t("Highlight {color}", { color: col })} onMouseDown={(e) => e.preventDefault()} onClick={() => c().setHighlight({ color: col }).run()} />
          ))}
          <B label={t("Back")} onClick={() => setColors(false)}>
            ←
          </B>
        </div>
      ) : (
        <>
          <B label={t("Bold")} on={s.bold} onClick={() => c().toggleBold().run()}>
            <Bold size={16} />
          </B>
          <B label={t("Italic")} on={s.italic} onClick={() => c().toggleItalic().run()}>
            <Italic size={16} />
          </B>
          <B label={t("Underline")} on={s.underline} onClick={() => c().toggleUnderline().run()}>
            <Underline size={16} />
          </B>
          <B label={t("Strikethrough")} on={s.strike} onClick={() => c().toggleStrike().run()}>
            <Strikethrough size={16} />
          </B>
          <B label={t("Colour")} onClick={() => setColors(true)}>
            <span className="tb-color">
              <Highlighter size={15} />
              <i style={{ background: "linear-gradient(90deg,#e2533a,#e2a634,#5cc46a,#3fa7d6,#8b5cf6)" }} />
            </span>
          </B>
          <B label={t("Link")} on={s.link} onClick={onLink}>
            <Link2 size={16} />
          </B>
          <B label={t("Clear formatting")} onClick={() => c().unsetAllMarks().run()}>
            <RemoveFormatting size={16} />
          </B>
        </>
      )}
    </BubbleMenu>
  );
}

/** The link under the cursor: where it goes, edit, open, remove. */
export function LinkBubble({ editor, onEdit }: { editor: Editor; onEdit: () => void }) {
  const t = useT();
  const href = useEditorState({ editor, selector: ({ editor: e }) => (e.isActive("link") ? (e.getAttributes("link").href as string) : "") });
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="linkBubble"
      options={{ placement: "bottom", offset: 8 }}
      shouldShow={({ editor: e, state }) => state.selection.empty && e.isActive("link") && e.isEditable}
      className="panel ed-bubble"
    >
      <a href={href} target="_blank" rel="noopener noreferrer" className="ed-link-url" title={href}>
        {href.replace(/^https?:\/\//, "")}
      </a>
      <B label={t("Edit link")} onClick={onEdit}>
        <Pencil size={15} />
      </B>
      <B label={t("Open link")} onClick={() => window.open(href, "_blank", "noopener")}>
        <ExternalLink size={15} />
      </B>
      <B label={t("Remove link")} onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}>
        <Unlink size={15} />
      </B>
    </BubbleMenu>
  );
}

/** A selected picture: size, alignment, description, remove. */
export function ImageBubble({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => (isImage(e) ? { align: (e.getAttributes("image").align as string) || "", alt: (e.getAttributes("image").alt as string) || "", width: e.getAttributes("image").width as number | null } : null),
  });
  const t = useT();
  const [alt, setAlt] = useState<string | null>(null);
  const width = (f: number) => {
    const full = (editor.view.dom as HTMLElement).clientWidth - 24;
    const img = editor.view.dom.querySelector<HTMLImageElement>(".ProseMirror-selectednode img, img.ProseMirror-selectednode");
    const ratio = img && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 0.66;
    const w = Math.round(full * f);
    editor.chain().focus().updateAttributes("image", { width: w, height: Math.round(w * ratio) }).run();
  };
  return (
    <>
      <BubbleMenu editor={editor} pluginKey="imageBubble" options={{ placement: "top", offset: 8 }} shouldShow={({ editor: e }) => isImage(e) && e.isEditable} className="panel ed-bubble">
        <B label={t("Small")} onClick={() => width(0.33)}>
          <span className="tb-text">S</span>
        </B>
        <B label={t("Medium")} onClick={() => width(0.55)}>
          <span className="tb-text">M</span>
        </B>
        <B label={t("Large")} onClick={() => width(0.8)}>
          <span className="tb-text">L</span>
        </B>
        <B label={t("Full width")} onClick={() => editor.chain().focus().updateAttributes("image", { width: null, height: null }).run()}>
          <span className="tb-text">Full</span>
        </B>
        <span className="tb-sep" />
        <B label={t("Left, text beside it")} on={s?.align === "left"} onClick={() => editor.chain().focus().updateAttributes("image", { align: s?.align === "left" ? null : "left" }).run()}>
          <AlignLeft size={16} />
        </B>
        <B label={t("Centre")} on={s?.align === "center"} onClick={() => editor.chain().focus().updateAttributes("image", { align: s?.align === "center" ? null : "center" }).run()}>
          <AlignCenter size={16} />
        </B>
        <B label={t("Right, text beside it")} on={s?.align === "right"} onClick={() => editor.chain().focus().updateAttributes("image", { align: s?.align === "right" ? null : "right" }).run()}>
          <AlignRight size={16} />
        </B>
        <span className="tb-sep" />
        <B label={t("Description (for screen readers)")} onClick={() => setAlt(s?.alt ?? "")}>
          <span className="tb-text">Alt</span>
        </B>
        <B label={t("Remove the picture")} onClick={() => editor.chain().focus().deleteSelection().run()}>
          <Trash2 size={16} />
        </B>
      </BubbleMenu>
      {alt !== null ? (
        <Modal
          title={t("Describe the picture")}
          onClose={() => setAlt(null)}
          footer={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                editor.chain().focus().updateAttributes("image", { alt }).run();
                setAlt(null);
              }}
            >
              {t("Save")}
            </button>
          }
        >
          <input className="input" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={300} placeholder={t("A dog on a skateboard")} autoFocus />
          <p className="hint">{t("Read out by screen readers, and shown if the picture can't load.")}</p>
        </Modal>
      ) : null}
    </>
  );
}

/** Add or change a link: the words shown and where it goes. */
export function LinkDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const t = useT();
  const existing = editor.isActive("link") ? (editor.getAttributes("link").href as string) : "";
  const { from, to, empty } = editor.state.selection;
  const selected = empty ? "" : editor.state.doc.textBetween(from, to, " ");
  const [url, setUrl] = useState(existing);
  const [text, setText] = useState(selected);
  const needsText = empty && !existing;
  const save = () => {
    let href = url.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onClose();
      return;
    }
    if (!/^(https?:|mailto:|tel:|\/)/i.test(href)) href = href.includes("@") && !href.includes("/") ? `mailto:${href}` : `https://${href}`;
    if (needsText) {
      const label = text.trim() || href.replace(/^https?:\/\//, "");
      editor.chain().focus().insertContent({ type: "text", text: label, marks: [{ type: "link", attrs: { href } }] }).insertContent(" ").run();
    } else editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    onClose();
  };
  return (
    <Modal
      title={existing ? t("Edit the link") : t("Add a link")}
      onClose={onClose}
      footer={
        <>
          {existing ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                onClose();
              }}
            >
              <Unlink size={15} /> {t("Remove link")}
            </button>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={save}>
            {existing ? t("Save") : t("Add link")}
          </button>
        </>
      }
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="field">
          <label htmlFor="ld-url">{t("Address")}</label>
          <input id="ld-url" className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("https://… or paste a link")} inputMode="url" autoComplete="off" autoFocus />
        </div>
        {needsText ? (
          <div className="field">
            <label htmlFor="ld-text">{t("Text to show")}</label>
            <input id="ld-text" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("Optional: the address is shown otherwise")} />
          </div>
        ) : null}
        <p className="hint" style={{ margin: 0 }}>
          {t("Tip: paste a link straight into the text and it becomes a link by itself. Select words first and paste a link over them to link those words.")}
        </p>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/** Add a YouTube video by its address. */
export function VideoDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const t = useT();
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  const save = () => {
    const ok = editor.chain().focus().setYoutubeVideo({ src: url.trim() }).run();
    if (ok) onClose();
    else setErr(t("That doesn't look like a YouTube address."));
  };
  return (
    <Modal
      title={t("Add a YouTube video")}
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-primary" onClick={save}>
          {t("Add video")}
        </button>
      }
    >
      <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" autoFocus onKeyDown={(e) => e.key === "Enter" && save()} />
      {err ? <div className="form-error" style={{ marginTop: 10 }}>{err}</div> : null}
    </Modal>
  );
}

/** Adding a picture: from this device, or from a link (the site keeps a copy). */
export function PictureDialog({ onPick, onLink, onClose }: { onPick: () => void; onLink: (url: string) => Promise<string | null>; onClose: () => void }) {
  const t = useT();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const add = async () => {
    if (!url.trim() || busy) return;
    setBusy(true);
    setErr("");
    const problem = await onLink(url.trim());
    setBusy(false);
    if (problem) setErr(problem);
    else onClose();
  };
  return (
    <Modal
      title={t("Add a picture")}
      onClose={onClose}
      footer={
        <button type="button" className={`btn btn-primary ${busy ? "loading" : ""}`} disabled={!url.trim() || busy} onClick={() => void add()}>
          {busy ? <LoaderCircle size={15} className="spin" /> : null} {t("Add the picture")}
        </button>
      }
    >
      <div className="stack">
        <button
          type="button"
          className="btn btn-block"
          onClick={() => {
            onClose();
            onPick();
          }}
        >
          <ImagePlus size={16} /> {t("Choose pictures on this device…")}
        </button>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="pic-link">{t("Or a link to a picture")}</label>
          <input
            id="pic-link"
            className="input"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            autoFocus={!touch()}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              void add();
            }}
          />
          <span className="tiny muted">{t("A link to a page works too: its own picture is used. The site keeps a copy, so the picture stays even if the link stops working.")}</span>
        </div>
        {err ? <div className="form-error">{err}</div> : null}
      </div>
    </Modal>
  );
}
