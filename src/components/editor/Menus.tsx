"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { NodeSelection } from "@tiptap/pm/state";
import { AlignCenter, AlignLeft, AlignRight, Bold, ExternalLink, FileText, Highlighter, ImagePlus, Italic, Link2, LoaderCircle, MessagesSquare, Pencil, RemoveFormatting, Search, Strikethrough, Trash2, Underline, Unlink } from "lucide-react";
import { HIGHLIGHTS, TEXT_COLORS } from "./Toolbar";
import { Modal } from "@/components/ui/ui";
import { Time } from "@/components/ui/Time";
import { useSite, useT } from "@/components/app/AppProvider";
import { KIND_ICON, KIND_ONE, Marked } from "@/components/search/SearchResults";
import { allSections } from "@/components/shell/nav";
import { isAddress, plainTitle, useLinkSearch, useLinkTarget } from "./linkTargets";

const isImage = (e: Editor) => e.state.selection instanceof NodeSelection && e.state.selection.node.type.name === "image";
const touch = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

type Flip = NonNullable<NonNullable<React.ComponentProps<typeof BubbleMenu>["options"]>["flip"]>;

/**
 * Where a bubble may go: in a full editor, whose toolbar is above the text (and stays at the top as
 * the page scrolls), only below that toolbar, so a bubble over the first lines turns to under the
 * selection instead of covering the toolbar. A compact editor's bubbles go anywhere on screen.
 */
const clearOfToolbar =
  (editor: Editor): Flip =>
  () => {
    const ed = editor.view.dom.closest(".editor");
    const bar = ed?.classList.contains("full") ? ed.querySelector(".ed-toolbar") : null;
    const body = ed?.querySelector(".ed-body");
    if (!bar || !body) return {};
    const top = Math.max(body.getBoundingClientRect().top, 0);
    return { boundary: body, padding: { top: Math.max(bar.getBoundingClientRect().bottom - top, 0) + 4 } };
  };

function B({ on, label, onClick, children }: { on?: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`tb-btn ${on ? "on" : ""}`} title={label} aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}

/**
 * Quick formatting over selected text. On a touch screen it's under the selection, clear of the
 * selection's handles (the phone's own menu, cut, copy, …, is above it).
 */
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
      options={{ placement: touch() ? "bottom" : "top", offset: touch() ? 32 : 8, flip: clearOfToolbar(editor) }}
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

/** The link under the cursor: where it goes (for a link on the site, what it is), edit, open, remove. */
export function LinkBubble({ editor, onEdit }: { editor: Editor; onEdit: () => void }) {
  const t = useT();
  const site = useSite();
  const href = useEditorState({ editor, selector: ({ editor: e }) => (e.isActive("link") ? (e.getAttributes("link").href as string) : "") });
  const target = useLinkTarget(href);
  const place = allSections(site.features).find((p) => p.href === href);
  const Icon = target ? KIND_ICON[target.kind] : place?.icon;
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="linkBubble"
      options={{ placement: "bottom", offset: 8, flip: clearOfToolbar(editor) }}
      shouldShow={({ editor: e, state }) => state.selection.empty && e.isActive("link") && e.isEditable}
      className="panel ed-bubble"
    >
      <a href={href} target="_blank" rel="noopener noreferrer" className="ed-link-url" title={href}>
        {Icon ? <Icon size={13} /> : null} {target ? target.title : place ? t(place.label) : href.replace(/^https?:\/\//, "")}
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
      <BubbleMenu editor={editor} pluginKey="imageBubble" options={{ placement: "top", offset: 8, flip: clearOfToolbar(editor) }} shouldShow={({ editor: e }) => isImage(e) && e.isEditable} className="panel ed-bubble">
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

/**
 * Add or change a link. Where it goes: anything on the site, found by typing in the same field as an
 * address (before anything is typed: the site's sections and the latest things), linked with a tap;
 * or an address. Without words selected, the words to show (else the title of what it goes to).
 */
export function LinkDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const t = useT();
  const site = useSite();
  const existing = editor.isActive("link") ? (editor.getAttributes("link").href as string) : "";
  const { from, to, empty } = editor.state.selection;
  const selected = empty ? "" : editor.state.doc.textBetween(from, to, " ");
  const [url, setUrl] = useState(existing);
  const [text, setText] = useState(selected);
  const needsText = empty && !existing;
  const term = url.trim();
  const searching = !isAddress(term);
  const { found, busy } = useLinkSearch(searching ? term : null);
  const low = term.toLowerCase();
  // the sections (and, for what's typed, the forum's categories) whose names match
  const places = searching
    ? [
        ...allSections(site.features).map((p) => ({ label: t(p.label), url: p.href, Icon: p.icon, cat: false })),
        ...(found?.categories ?? []).map((c) => ({ label: c.name, url: c.url, Icon: MessagesSquare, cat: true })),
      ].filter((p) => (low ? p.label.toLowerCase().includes(low) : !p.cat))
    : [];
  const hits = searching ? (found?.hits ?? []) : [];
  const options = [...places.map((p) => ({ url: p.url, label: p.label })), ...hits.map((h) => ({ url: h.url, label: plainTitle(h.title) }))];
  // typing: the first match is the one Enter takes
  const [active, setActive] = useState(-1);
  useEffect(() => setActive(term && searching ? 0 : -1), [term, searching]);
  useEffect(() => document.getElementById(`ld-o${active}`)?.scrollIntoView({ block: "nearest", inline: "nearest" }), [active]);

  const link = (href: string, label: string) => {
    if (needsText) editor.chain().focus().insertContent({ type: "text", text: text.trim() || label, marks: [{ type: "link", attrs: { href } }] }).insertContent(" ").run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    onClose();
  };
  const pick = options[Math.min(active, options.length - 1)];
  // closed without a link: back to writing where you were
  const cancel = () => {
    editor.commands.focus();
    onClose();
  };
  const save = () => {
    if (searching) {
      if (active >= 0 && pick) link(pick.url, pick.label);
      return;
    }
    let href = term;
    // this site's own address: a link on the site (it opens here, and keeps working if the address changes)
    if (href.startsWith(`${location.origin}/`)) href = href.slice(location.origin.length);
    if (!/^(https?:|mailto:|tel:|\/)/i.test(href)) href = href.includes("@") && !href.includes("/") ? `mailto:${href}` : `https://${href}`;
    link(href, href.replace(/^https?:\/\//, ""));
  };
  return (
    <Modal
      title={existing ? t("Edit the link") : t("Add a link")}
      onClose={cancel}
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
          <button type="button" className="btn btn-primary" disabled={searching && !(active >= 0 && pick)} onClick={save}>
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
        {needsText ? (
          <div className="field">
            <label htmlFor="ld-text">{t("Text to show")}</label>
            <input id="ld-text" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("Optional: the title or address is shown otherwise")} />
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="ld-url">{t("Link to")}</label>
          <div className="chat-search link-search">
            <Search size={15} />
            <input
              id="ld-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (!options.length || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
                e.preventDefault();
                setActive((a) => (e.key === "ArrowDown" ? Math.min(a + 1, options.length - 1) : Math.max(a - 1, 0)));
              }}
              placeholder={t("Search the site, or paste an address")}
              role="combobox"
              aria-expanded={searching}
              aria-controls="ld-list"
              aria-autocomplete="list"
              aria-activedescendant={searching && active >= 0 && pick ? `ld-o${Math.min(active, options.length - 1)}` : undefined}
              autoComplete="off"
              autoFocus
            />
          </div>
        </div>
        {searching ? (
          <div id="ld-list" className="link-found" role="listbox" aria-label={t("On the site")}>
            {places.length ? (
              <div className="chip-row link-places" role="group" aria-label={t("Places")}>
                {places.map((p, i) => (
                  <button key={p.url} id={`ld-o${i}`} type="button" role="option" aria-selected={active === i} className={`pill soft ${active === i ? "on" : ""}`} onClick={() => link(p.url, p.label)}>
                    <p.Icon size={14} /> {p.cat ? `${t("Forum")} · ${p.label}` : p.label}
                  </button>
                ))}
              </div>
            ) : null}
            {hits.length && !term ? <span className="eyebrow">{t("Latest")}</span> : null}
            {hits.length ? (
              <div className="link-hits" role="group" aria-label={term ? t("Found") : t("Latest")}>
                {hits.map((h, j) => {
                  const i = places.length + j;
                  const Icon = KIND_ICON[h.kind] || FileText;
                  return (
                    <button key={h.url} id={`ld-o${i}`} type="button" role="option" aria-selected={active === i} className={`list-row search-hit ${active === i ? "on" : ""}`} onClick={() => link(h.url, plainTitle(h.title))}>
                      <span className="hit-icon">
                        <Icon size={16} />
                      </span>
                      <span className="grow" style={{ minWidth: 0 }}>
                        <span className="hit-title ellipsis">
                          <Marked text={h.title} />
                        </span>
                        {/* (a reply or a comment has its thread's or post's title: what it says tells them apart) */}
                        {h.snippet && (h.kind === "reply" || h.kind === "comment") ? (
                          <span className="hit-snip ellipsis">
                            <Marked text={h.snippet} />
                          </span>
                        ) : null}
                        <span className="tiny faint">
                          {t(KIND_ONE[h.kind])}
                          {h.author && h.kind !== "user" ? ` · ${h.author.name}` : ""}
                          {h.kind !== "user" && h.kind !== "group" && h.kind !== "room" ? (
                            <>
                              {" · "}
                              <Time t={h.createdAt} />
                            </>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {term && found && !busy && !options.length ? <p className="small muted" style={{ margin: 0 }}>{t("Nothing on the site matches “{q}”. To link to another site, paste its address.", { q: term })}</p> : null}
          </div>
        ) : null}
        {!term || !searching ? (
          <p className="hint" style={{ margin: 0 }}>
            {t("Tip: paste a link straight into the text and it becomes a link by itself. Select words first and paste a link over them to link those words.")}
          </p>
        ) : null}
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
