"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Extension, InputRule, Node, type Editor } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { mentionOpen } from "./mentionState";
import { place } from "./mention";
import { customName, siteEmojis } from "@/components/emoji/Emojis";
import { loadEmoji, loadedEmoji } from "@/components/ui/emojiData";
import { clientT } from "@/lib/i18n";

/**
 * The site's own emoji in the editor, Discord style: a picture the size of the text, written
 * :name:. Typing :name: (the closing colon) turns it into one, and so does an emoji's own name
 * (:thumbs_up: → 👍); after ":" and two letters a list suggests both kinds.
 */

export const CustomEmoji = Node.create({
  name: "customEmoji",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,
  draggable: false,
  addAttributes() {
    return {
      name: { default: "", parseHTML: (el) => el.getAttribute("data-emoji") ?? "" },
      src: { default: "", parseHTML: (el) => el.getAttribute("src") ?? "" },
    };
  },
  // (before pictures: it's an <img> too)
  parseHTML() {
    return [{ tag: "img[data-emoji]", priority: 100 }];
  },
  renderHTML({ node }) {
    const n = `:${node.attrs.name}:`;
    return ["img", { src: node.attrs.src, alt: n, title: n, "data-emoji": node.attrs.name, class: "emoji-custom", draggable: "false" }];
  },
  renderText({ node }) {
    return `:${node.attrs.name}:`;
  },
  addInputRules() {
    return [
      new InputRule({
        // not inside a word or a time (10:30:): after a space, a bracket or nothing
        find: /(?:^|[\s([{"'])(:([a-z0-9_]{2,32}):)$/i,
        handler: ({ state, range, match }) => {
          const name = match[2].toLowerCase();
          // (the closing colon isn't in the text yet: the range ends where it would go)
          const from = range.from + match[0].length - match[1].length;
          const own = siteEmojis.byName.get(name);
          if (own) {
            state.tr.replaceWith(from, range.to, this.type.create({ name, src: own.url }));
            return;
          }
          const emoji = byShortName(name);
          if (!emoji) return null;
          state.tr.insertText(emoji, from, range.to);
        },
      }),
    ];
  },
});

type Emoji = [string, string, number, string];

/** "thumbs_up" → 👍 (an emoji's own name with _ for spaces, in the reader's language) */
function byShortName(name: string): string | null {
  const list = loadedEmoji(clientT().lang) as Emoji[] | null;
  return list?.find((e) => e[1].replace(/\s+/g, "_") === name)?.[0] ?? null;
}

/** Put an emoji where the cursor is: one of the site's own (":name:") as its picture, any other as text. */
export function insertEmoji(editor: Editor, e: string) {
  const name = customName(e);
  const own = name ? siteEmojis.byName.get(name) : undefined;
  if (own) editor.chain().focus().insertContent({ type: "customEmoji", attrs: { name: own.name, src: own.url } }).run();
  else editor.chain().focus().insertContent(e).run();
}

interface Item {
  /** ":name:" for the site's own, else the emoji */
  emoji: string;
  name: string;
  url?: string;
}

interface ListHandle {
  onKeyDown: (e: KeyboardEvent) => boolean;
}

const EmojiList = forwardRef<ListHandle, SuggestionProps<Item>>(function EmojiList(props, ref) {
  const [sel, setSel] = useState(0);
  useEffect(() => setSel(0), [props.items]);
  const pick = (i: number) => {
    const it = props.items[i];
    if (it) props.command(it);
  };
  useImperativeHandle(ref, () => ({
    onKeyDown: (e) => {
      if (!props.items.length) return false;
      if (e.key === "ArrowUp") {
        setSel((s) => (s + props.items.length - 1) % props.items.length);
        return true;
      }
      if (e.key === "ArrowDown") {
        setSel((s) => (s + 1) % props.items.length);
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        pick(sel);
        return true;
      }
      return false;
    },
  }));
  if (!props.items.length) return null;
  return (
    <div className="panel mention-list emoji-suggest" role="listbox">
      {props.items.map((it, i) => (
        <button key={it.emoji} type="button" role="option" aria-selected={i === sel} className={`menu-item ${i === sel ? "sel" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(i)}>
          <span className="emoji-suggest-glyph">{it.url ? <img className="emoji-custom" src={it.url} alt="" /> : it.emoji}</span>
          <span className="ellipsis">:{it.name}:</span>
        </button>
      ))}
    </div>
  );
});

async function suggest(query: string): Promise<Item[]> {
  const q = query.toLowerCase();
  if (q.length < 2 || !/^[\p{L}\p{N}_]+$/u.test(q)) return [];
  const starts = (s: string) => Number(!s.startsWith(q));
  const own = [...siteEmojis.byName.values()]
    .filter((e) => e.name.includes(q))
    .sort((a, b) => starts(a.name) - starts(b.name))
    .map((e): Item => ({ emoji: `:${e.name}:`, name: e.name, url: e.url }));
  const all = ((await loadEmoji(clientT().lang)) as Emoji[]).map((e) => ({ e, short: e[1].replace(/\s+/g, "_") }));
  const std = all
    .filter((x) => x.short.includes(q) || x.e[3].split(" ").some((w) => w.startsWith(q)))
    .sort((a, b) => starts(a.short) - starts(b.short))
    .map((x): Item => ({ emoji: x.e[0], name: x.short }));
  return [...own, ...std].slice(0, 8);
}

const key = new PluginKey("emojiSuggest");

export const EmojiSuggest = Extension.create({
  name: "emojiSuggest",
  // the emoji's names, ready for :thumbs_up: by the time it's typed
  onFocus() {
    void loadEmoji(clientT().lang);
  },
  addProseMirrorPlugins() {
    return [
      Suggestion<Item>({
        editor: this.editor,
        pluginKey: key,
        char: ":",
        items: ({ query }) => suggest(query),
        command: ({ editor, range, props }) => {
          const own = props.url ? siteEmojis.byName.get(props.name) : undefined;
          editor
            .chain()
            .focus()
            .insertContentAt(range, [own ? { type: "customEmoji", attrs: { name: own.name, src: own.url } } : { type: "text", text: props.emoji }, { type: "text", text: " " }])
            .run();
        },
        render: () => {
          let renderer: ReactRenderer<ListHandle, SuggestionProps<Item>> | null = null;
          let box: HTMLDivElement | null = null;
          // Enter picks from the list only while it shows something
          const showing = (props: SuggestionProps<Item>) => {
            mentionOpen.current = props.items.length > 0;
            if (box) box.hidden = !props.items.length;
          };
          return {
            onStart: (props) => {
              renderer = new ReactRenderer(EmojiList, { props, editor: props.editor });
              box = document.createElement("div");
              box.className = "mention-pop";
              box.appendChild(renderer.element);
              document.body.appendChild(box);
              showing(props);
              requestAnimationFrame(() => box && place(box, props.clientRect?.()));
            },
            onUpdate: (props) => {
              renderer?.updateProps(props);
              showing(props);
              if (box) place(box, props.clientRect?.());
            },
            onKeyDown: (props) => {
              if (props.event.key === "Escape" && box && !box.hidden) {
                box.hidden = true;
                mentionOpen.current = false;
                return true;
              }
              return renderer?.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
              mentionOpen.current = false;
              box?.remove();
              renderer?.destroy();
              box = null;
              renderer = null;
            },
          };
        },
      }),
    ];
  },
});
