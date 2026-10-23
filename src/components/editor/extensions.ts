import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Youtube from "@tiptap/extension-youtube";
import Mention from "@tiptap/extension-mention";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import type { Extensions } from "@tiptap/core";
import { mentionSuggestion } from "./mention";

/** Pictures can be resized by their corner and set left, centre or right. */
export const HoodenImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-align"),
        renderHTML: (attrs) => (attrs.align ? { "data-align": attrs.align } : {}),
      },
    };
  },
});

export interface ExtensionOptions {
  placeholder: string;
  compact: boolean;
  limit?: number;
  /** Enter sends (chat); Shift+Enter makes a new line */
  onEnter?: () => boolean;
}

export function buildExtensions(o: ExtensionOptions): Extensions {
  const exts: Extensions = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        HTMLAttributes: { rel: "noopener noreferrer nofollow ugc", target: "_blank" },
      },
      codeBlock: { HTMLAttributes: { spellcheck: "false" } },
    }),
    TextStyleKit.configure({ lineHeight: false }),
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    HoodenImage.configure({
      inline: false,
      allowBase64: false,
      resize: { enabled: true, directions: ["bottom-right", "bottom-left", "top-right", "top-left"], minWidth: 60, minHeight: 40, alwaysPreserveAspectRatio: true },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Subscript,
    Superscript,
    Mention.configure({
      HTMLAttributes: { class: "mention" },
      suggestion: mentionSuggestion,
      renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
      renderHTML: ({ options, node }) => ["span", { ...options.HTMLAttributes, "data-type": "mention", "data-id": node.attrs.id, "data-label": node.attrs.label }, `@${node.attrs.label ?? node.attrs.id}`],
    }),
    Placeholder.configure({ placeholder: o.placeholder }),
    CharacterCount.configure({ limit: o.limit }),
  ];
  if (!o.compact) {
    exts.push(
      Table.configure({ resizable: true, HTMLAttributes: { class: "rt-table" } }),
      TableRow,
      TableHeader,
      TableCell,
      Youtube.configure({ nocookie: true, modestBranding: true, HTMLAttributes: { class: "video-embed" } }),
    );
  }
  return exts;
}
