"use client";

import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AtSign,
  Bold,
  ChevronDown,
  Code,
  Ellipsis,
  Film,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Maximize2,
  Minimize2,
  Minus,
  Redo2,
  RemoveFormatting,
  Smile,
  SquareCode,
  Strikethrough,
  Subscript as SubIcon,
  Superscript as SupIcon,
  Table2,
  Type,
  Underline,
  Undo2,
} from "lucide-react";
import { PopButton } from "@/components/ui/Popover";
import { EmojiPopover } from "@/components/ui/EmojiPicker";
import { CONTENT_FONTS, FONT_SIZES } from "@/lib/fontChoices";

export const TEXT_COLORS = [
  "#e2533a", "#ef8a3a", "#e2a634", "#f2d14b", "#5cc46a", "#2fa39a", "#3fa7d6", "#5b7bd6",
  "#8b5cf6", "#c05bd6", "#e05a9a", "#a16a3f", "#ffffff", "#b8bcc2", "#6b7280", "#111111",
];
export const HIGHLIGHTS = ["#fde68a", "#fecaca", "#fed7aa", "#bbf7d0", "#a5f3fc", "#bfdbfe", "#ddd6fe", "#fbcfe8", "#e5e7eb"];

const BLOCKS = [
  { id: "p", label: "Normal text" },
  { id: "h1", label: "Big heading" },
  { id: "h2", label: "Heading" },
  { id: "h3", label: "Small heading" },
  { id: "quote", label: "Quote" },
  { id: "code", label: "Code block" },
] as const;

function Btn({ on, label, onClick, children, disabled, kbd }: { on?: boolean; label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; kbd?: string }) {
  return (
    <button type="button" className={`tb-btn ${on ? "on" : ""}`} title={kbd ? `${label} (${kbd})` : label} aria-label={label} aria-pressed={on} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}

const Sep = () => <span className="tb-sep" aria-hidden />;

export function ColorGrid({ colors, current, onPick, onClear, clearLabel, custom = true }: { colors: string[]; current?: string | null; onPick: (c: string) => void; onClear: () => void; clearLabel: string; custom?: boolean }) {
  return (
    <div className="stack tight" style={{ padding: 4 }}>
      <button type="button" className="menu-item" onClick={onClear}>
        <span className="swatch" style={{ background: "transparent", boxShadow: "inset 0 0 0 1px var(--line-strong)", width: 18, height: 18, position: "relative" }}>
          <svg width="18" height="18" viewBox="0 0 18 18" style={{ position: "absolute", inset: 0 }}>
            <path d="M3 15 15 3" stroke="var(--err)" strokeWidth="2" />
          </svg>
        </span>
        {clearLabel}
      </button>
      <div className="swatches" style={{ display: "grid", gridTemplateColumns: "repeat(8, 26px)", gap: 6 }}>
        {colors.map((c) => (
          <button key={c} type="button" className={`swatch ${current?.toLowerCase() === c ? "on" : ""}`} style={{ background: c }} title={c} aria-label={c} onClick={() => onPick(c)} />
        ))}
      </div>
      {custom ? (
        <label className="row small muted" style={{ padding: "4px 2px" }}>
          <input type="color" className="swatch-input" defaultValue={current || "#e2a634"} onChange={(e) => onPick(e.target.value)} />
          Any colour…
        </label>
      ) : null}
    </div>
  );
}

export function Toolbar({
  editor,
  compact,
  expanded,
  onExpand,
  onImage,
  onLink,
  onVideo,
}: {
  editor: Editor;
  compact: boolean;
  expanded: boolean;
  onExpand: () => void;
  onImage: () => void;
  onLink: () => void;
  onVideo: () => void;
}) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      sub: e.isActive("subscript"),
      sup: e.isActive("superscript"),
      table: e.isActive("table"),
      block: e.isActive("heading", { level: 1 })
        ? "h1"
        : e.isActive("heading", { level: 2 })
          ? "h2"
          : e.isActive("heading", { level: 3 })
            ? "h3"
            : e.isActive("blockquote")
              ? "quote"
              : e.isActive("codeBlock")
                ? "code"
                : "p",
      align: (["center", "right", "justify"] as const).find((a) => e.isActive({ textAlign: a })) ?? "left",
      font: (e.getAttributes("textStyle").fontFamily as string | undefined) ?? null,
      size: (e.getAttributes("textStyle").fontSize as string | undefined) ?? null,
      color: (e.getAttributes("textStyle").color as string | undefined) ?? null,
      highlight: (e.getAttributes("highlight").color as string | undefined) ?? null,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const [emoji, setEmoji] = useState(false);
  const emojiBtn = useRef<HTMLButtonElement>(null);
  const c = () => editor.chain().focus();
  const fontLabel = CONTENT_FONTS.find((f) => f.value === s.font)?.label ?? "Font";
  const AlignIcon = s.align === "center" ? AlignCenter : s.align === "right" ? AlignRight : s.align === "justify" ? AlignJustify : AlignLeft;

  const setBlock = (id: string) => {
    const ch = c();
    if (id === "p") ch.setParagraph().run();
    else if (id === "h1") ch.toggleHeading({ level: 1 }).run();
    else if (id === "h2") ch.toggleHeading({ level: 2 }).run();
    else if (id === "h3") ch.toggleHeading({ level: 3 }).run();
    else if (id === "quote") ch.toggleBlockquote().run();
    else if (id === "code") ch.toggleCodeBlock().run();
  };

  return (
    <div className="ed-toolbar" role="toolbar" aria-label="Formatting">
      {!compact ? (
        <>
          <Btn label="Undo" kbd="Ctrl+Z" onClick={() => c().undo().run()} disabled={!s.canUndo}>
            <Undo2 size={17} />
          </Btn>
          <Btn label="Redo" kbd="Ctrl+Shift+Z" onClick={() => c().redo().run()} disabled={!s.canRedo}>
            <Redo2 size={17} />
          </Btn>
          <Sep />
          <PopButton label="Text style" className="tb-btn tb-wide" width={210} button={<><span className="tb-text">{BLOCKS.find((b) => b.id === s.block)?.label}</span><ChevronDown size={14} /></>}>
            {(close) => (
              <div className="stack" style={{ gap: 2, padding: 4 }}>
                {BLOCKS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`menu-item blk-${b.id} ${s.block === b.id ? "sel" : ""}`}
                    onClick={() => {
                      setBlock(b.id);
                      close();
                    }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            )}
          </PopButton>
        </>
      ) : null}
      <PopButton label="Font" className="tb-btn tb-wide" width={220} button={<><Type size={15} /><span className="tb-text" style={{ fontFamily: s.font ?? undefined }}>{fontLabel}</span><ChevronDown size={14} /></>}>
        {(close) => (
          <div className="stack popover-scroll" style={{ gap: 2, padding: 4 }}>
            <button
              type="button"
              className={`menu-item ${!s.font ? "sel" : ""}`}
              onClick={() => {
                c().unsetFontFamily().run();
                close();
              }}
            >
              Site font
            </button>
            {CONTENT_FONTS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`menu-item ${s.font === f.value ? "sel" : ""}`}
                style={{ fontFamily: f.value, fontSize: f.id === "pixel" ? 11 : 16 }}
                onClick={() => {
                  c().setFontFamily(f.value).run();
                  close();
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </PopButton>
      <PopButton label="Text size" className="tb-btn tb-size" width={150} button={<><span className="tb-text">{s.size ? parseInt(s.size) : "Size"}</span><ChevronDown size={14} /></>}>
        {(close) => (
          <div className="stack popover-scroll" style={{ gap: 2, padding: 4 }}>
            <button
              type="button"
              className={`menu-item ${!s.size ? "sel" : ""}`}
              onClick={() => {
                c().unsetFontSize().run();
                close();
              }}
            >
              Normal
            </button>
            {FONT_SIZES.map((z) => (
              <button
                key={z}
                type="button"
                className={`menu-item ${s.size === z ? "sel" : ""}`}
                style={{ fontSize: Math.min(28, parseInt(z)) }}
                onClick={() => {
                  c().setFontSize(z).run();
                  close();
                }}
              >
                {parseInt(z)}
              </button>
            ))}
          </div>
        )}
      </PopButton>
      <Sep />
      <Btn label="Bold" kbd="Ctrl+B" on={s.bold} onClick={() => c().toggleBold().run()}>
        <Bold size={17} />
      </Btn>
      <Btn label="Italic" kbd="Ctrl+I" on={s.italic} onClick={() => c().toggleItalic().run()}>
        <Italic size={17} />
      </Btn>
      <Btn label="Underline" kbd="Ctrl+U" on={s.underline} onClick={() => c().toggleUnderline().run()}>
        <Underline size={17} />
      </Btn>
      <Btn label="Strikethrough" kbd="Ctrl+Shift+S" on={s.strike} onClick={() => c().toggleStrike().run()}>
        <Strikethrough size={17} />
      </Btn>
      <PopButton
        label="Text colour"
        width={260}
        button={
          <span className="tb-color">
            <span style={{ fontWeight: 800, fontSize: 15, lineHeight: 1 }}>A</span>
            <i style={{ background: s.color || "currentColor" }} />
          </span>
        }
      >
        {(close) => (
          <ColorGrid
            colors={TEXT_COLORS}
            current={s.color}
            clearLabel="Default colour"
            onClear={() => {
              c().unsetColor().run();
              close();
            }}
            onPick={(col) => {
              c().setColor(col).run();
            }}
          />
        )}
      </PopButton>
      <PopButton label="Highlight" width={260} active={!!s.highlight} button={<span className="tb-color"><Highlighter size={16} /><i style={{ background: s.highlight || "#fde68a" }} /></span>}>
        {(close) => (
          <ColorGrid
            colors={HIGHLIGHTS}
            current={s.highlight}
            clearLabel="No highlight"
            onClear={() => {
              c().unsetHighlight().run();
              close();
            }}
            onPick={(col) => {
              c().setHighlight({ color: col }).run();
              close();
            }}
          />
        )}
      </PopButton>
      <Sep />
      <Btn label="Link" kbd="Ctrl+K" on={s.link} onClick={onLink}>
        <Link2 size={17} />
      </Btn>
      <Btn label="Add a picture" onClick={onImage}>
        <ImagePlus size={17} />
      </Btn>
      <button ref={emojiBtn} type="button" className={`tb-btn ${emoji ? "on" : ""}`} title="Emoji" aria-label="Emoji" onMouseDown={(e) => e.preventDefault()} onClick={() => setEmoji((x) => !x)}>
        <Smile size={17} />
      </button>
      {emoji ? (
        <EmojiPopover
          anchor={emojiBtn.current}
          onPick={(e) => {
            editor.chain().focus().insertContent(e).run();
          }}
          onClose={() => setEmoji(false)}
        />
      ) : null}
      <Btn label="Mention someone" onClick={() => c().insertContent(" @").run()}>
        <AtSign size={17} />
      </Btn>
      <Sep />
      <PopButton label="Alignment" width={190} button={<AlignIcon size={17} />}>
        {(close) => (
          <div className="stack" style={{ gap: 2, padding: 4 }}>
            {(
              [
                ["left", AlignLeft, "Left"],
                ["center", AlignCenter, "Centre"],
                ["right", AlignRight, "Right"],
                ["justify", AlignJustify, "Justify"],
              ] as const
            ).map(([a, Icon, label]) => (
              <button
                key={a}
                type="button"
                className={`menu-item ${s.align === a ? "sel" : ""}`}
                onClick={() => {
                  if (a === "left") c().unsetTextAlign().run();
                  else c().setTextAlign(a).run();
                  close();
                }}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
        )}
      </PopButton>
      <Btn label="Bulleted list" on={s.bullet} onClick={() => c().toggleBulletList().run()}>
        <List size={17} />
      </Btn>
      <Btn label="Numbered list" on={s.ordered} onClick={() => c().toggleOrderedList().run()}>
        <ListOrdered size={17} />
      </Btn>
      <Btn label="Checklist" on={s.task} onClick={() => c().toggleTaskList().run()}>
        <ListTodo size={17} />
      </Btn>
      <PopButton label="More" width={230} button={<Ellipsis size={17} />} active={s.table || s.code || s.sub || s.sup}>
        {(close) => (
          <div className="stack" style={{ gap: 2, padding: 4 }}>
            {compact ? (
              <>
                <button type="button" className="menu-item" onClick={() => { c().toggleHeading({ level: 2 }).run(); close(); }}>
                  <Type size={16} /> Heading
                </button>
                <button type="button" className="menu-item" onClick={() => { c().toggleBlockquote().run(); close(); }}>
                  <span style={{ width: 16, textAlign: "center", fontWeight: 900 }}>&ldquo;</span> Quote
                </button>
                <button type="button" className="menu-item" onClick={() => { c().toggleCodeBlock().run(); close(); }}>
                  <SquareCode size={16} /> Code block
                </button>
              </>
            ) : (
              <>
                {!s.table ? (
                  <button type="button" className="menu-item" onClick={() => { c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); close(); }}>
                    <Table2 size={16} /> Table
                  </button>
                ) : (
                  <>
                    <div className="menu-label">Table</div>
                    <button type="button" className="menu-item" onClick={() => c().addRowAfter().run()}>
                      + Row below
                    </button>
                    <button type="button" className="menu-item" onClick={() => c().addColumnAfter().run()}>
                      + Column right
                    </button>
                    <button type="button" className="menu-item" onClick={() => c().deleteRow().run()}>
                      − Remove row
                    </button>
                    <button type="button" className="menu-item" onClick={() => c().deleteColumn().run()}>
                      − Remove column
                    </button>
                    <button type="button" className="menu-item" onClick={() => c().toggleHeaderRow().run()}>
                      Header row on/off
                    </button>
                    <button type="button" className="menu-item danger" onClick={() => { c().deleteTable().run(); close(); }}>
                      Remove the table
                    </button>
                    <div className="menu-sep" />
                  </>
                )}
                <button type="button" className="menu-item" onClick={() => { c().setHorizontalRule().run(); close(); }}>
                  <Minus size={16} /> Divider line
                </button>
                <button type="button" className="menu-item" onClick={() => { onVideo(); close(); }}>
                  <Film size={16} /> YouTube video
                </button>
              </>
            )}
            <button type="button" className={`menu-item ${s.code ? "sel" : ""}`} onClick={() => { c().toggleCode().run(); close(); }}>
              <Code size={16} /> Inline code
            </button>
            <button type="button" className={`menu-item ${s.sub ? "sel" : ""}`} onClick={() => { c().toggleSubscript().run(); close(); }}>
              <SubIcon size={16} /> Subscript
            </button>
            <button type="button" className={`menu-item ${s.sup ? "sel" : ""}`} onClick={() => { c().toggleSuperscript().run(); close(); }}>
              <SupIcon size={16} /> Superscript
            </button>
            <div className="menu-sep" />
            <button type="button" className="menu-item" onClick={() => { c().unsetAllMarks().clearNodes().run(); close(); }}>
              <RemoveFormatting size={16} /> Clear formatting
            </button>
          </div>
        )}
      </PopButton>
      {!compact ? (
        <>
          <span className="spacer" />
          <Btn label={expanded ? "Smaller" : "Full screen"} onClick={onExpand}>
            {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </Btn>
        </>
      ) : null}
    </div>
  );
}
