import "server-only";
import sanitizeHtml from "sanitize-html";
import { CONTENT_FONT_VALUES } from "./fontChoices";
import { getSettings } from "./settings";
import { plain } from "./search";

/**
 * Everything people write goes through here before it's saved: only the editor's own formatting
 * survives (fonts, sizes, colours, alignment, lists, tables, links, pictures, mentions, videos).
 */

const COLOR = [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/, /^var\(--[a-z0-9-]+\)$/];
const FONT_FAMILY = [new RegExp(`^(${[...CONTENT_FONT_VALUES].map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`)];
const SIZE = [/^\d{1,2}(\.\d{1,2})?(px|em|rem)$/];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "h1", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "del", "strike", "sub", "sup", "code", "pre", "blockquote",
    "ul", "ol", "li", "a", "img", "span", "mark", "hr", "table", "thead", "tbody", "tr", "th", "td", "colgroup", "col", "div", "iframe", "label", "input",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel", "class", "data-bgg"],
    img: ["src", "alt", "title", "width", "height", "data-align", "data-thumb", "data-emoji", "class"],
    span: ["style", "class", "data-type", "data-id", "data-label"],
    mark: ["style", "data-color", "class"],
    p: ["style"],
    h1: ["style"],
    h2: ["style"],
    h3: ["style"],
    h4: ["style"],
    ul: ["data-type"],
    ol: ["start", "type"],
    li: ["data-type", "data-checked"],
    input: ["type", "checked", "disabled"],
    td: ["colspan", "rowspan", "colwidth", "style"],
    th: ["colspan", "rowspan", "colwidth", "style"],
    col: ["style", "span"],
    table: ["style"],
    div: ["data-youtube-video", "class"],
    iframe: ["src", "width", "height", "allowfullscreen", "frameborder", "allow"],
    code: ["class"],
    pre: ["class"],
  },
  allowedStyles: {
    "*": {
      "text-align": [/^(left|right|center|justify)$/],
      color: COLOR,
      "background-color": COLOR,
      "font-size": SIZE,
      "font-family": FONT_FAMILY,
      "line-height": [/^\d(\.\d{1,2})?$/],
    },
    col: { width: [/^\d{1,4}px$/], "min-width": [/^\d{1,4}px$/] },
    table: { width: [/^\d{1,4}px$/], "min-width": [/^\d{1,4}px$/] },
  },
  allowedClasses: {
    span: ["mention"],
    a: ["mention", "bgg-game"],
    img: ["emoji-custom"],
    code: ["language-*"],
    div: ["video-embed"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https"] },
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: false,
  allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com", "youtube.com", "player.vimeo.com"],
  allowIframeRelativeUrls: false,
  transformTags: {
    a: (tag, attribs) => {
      const href = attribs.href || "";
      const external = /^https?:\/\//i.test(href);
      const out: Record<string, string> = { ...attribs, ...(external ? { target: "_blank", rel: "noopener noreferrer nofollow ugc" } : { target: "", rel: "" }) };
      // a board game (bgg:): its number on BoardGameGeek (or "search"), and only to BGG
      const bgg = attribs["data-bgg"] ?? "";
      if (bgg || /\bbgg-game\b/.test(attribs.class ?? "")) {
        delete out["data-bgg"];
        out.class = (out.class ?? "").replace(/\bbgg-game\b/g, "").trim();
        if (/^(\d{1,9}|search)$/.test(bgg) && /^https:\/\/boardgamegeek\.com\//.test(href)) {
          out["data-bgg"] = bgg;
          out.class = `${out.class} bgg-game`.trim();
        }
      }
      return { tagName: "a", attribs: out };
    },
    img: (tag, attribs): sanitizeHtml.Tag => {
      const src = attribs.src || "";
      // our own pictures, or https links; never data: or javascript:
      if (!/^\/media\/[\w./-]+$/.test(src) && !/^https:\/\//i.test(src)) return { tagName: "span", attribs: {} };
      // one of the site's own emoji (:name:), drawn the size of the text around it
      const emoji = attribs["data-emoji"] || "";
      if (/^\/media\/emoji\//.test(src) && /^[a-z0-9_]{2,32}$/.test(emoji)) return { tagName: "img", attribs: { src, alt: `:${emoji}:`, title: `:${emoji}:`, "data-emoji": emoji, class: "emoji-custom" } };
      const width = /^\d{1,4}$/.test(attribs.width || "") ? attribs.width : undefined;
      const height = /^\d{1,4}$/.test(attribs.height || "") ? attribs.height : undefined;
      return {
        tagName: "img",
        attribs: {
          src,
          alt: (attribs.alt || "").slice(0, 300),
          ...(width ? { width } : {}),
          ...(height ? { height } : {}),
          ...(attribs["data-align"] && /^(left|center|right)$/.test(attribs["data-align"]) ? { "data-align": attribs["data-align"] } : {}),
        },
      };
    },
    input: (tag, attribs) => ({ tagName: "input", attribs: { type: "checkbox", disabled: "", ...(attribs.checked !== undefined ? { checked: "" } : {}) } }),
    iframe: (tag, attribs) => {
      const src = (attribs.src || "").replace(/^https:\/\/(www\.)?youtube\.com\/embed\//, "https://www.youtube-nocookie.com/embed/");
      return { tagName: "iframe", attribs: { src, width: "640", height: "360", allowfullscreen: "true", frameborder: "0", allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" } };
    },
  },
  exclusiveFilter: (frame) => frame.tag === "iframe" && !/^https:\/\/(www\.youtube-nocookie\.com|www\.youtube\.com|player\.vimeo\.com)\//.test(frame.attribs.src || ""),
};

export interface CleanContent {
  html: string;
  text: string;
  mentions: string[];
  firstImage: string | null;
  empty: boolean;
}

function filterWords(text: string, words: string[]): string {
  if (!words.length) return text;
  const re = new RegExp(`\\b(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi");
  return text.replace(re, (m) => m[0] + "*".repeat(Math.max(1, m.length - 1)));
}

export function cleanHtml(input: string, opts: { maxLength?: number } = {}): CleanContent {
  const words = getSettings().wordFilter.filter(Boolean);
  let html = sanitizeHtml(String(input || "").slice(0, opts.maxLength ?? 400_000), {
    ...OPTIONS,
    textFilter: words.length ? (text) => filterWords(text, words) : undefined,
  });
  // an editor with nothing in it leaves an empty paragraph behind
  html = html.replace(/^(<p>\s*<\/p>)+|(<p>\s*<\/p>)+$/g, "").trim();
  const mentions = [...html.matchAll(/data-type="mention"[^>]*data-id="([^"]+)"/g)].map((m) => m[1]);
  // (the site's own emoji aren't pictures for this)
  const img = html.match(/<img(?![^>]*data-emoji)[^>]*src="([^"]+)"/);
  const text = plain(html);
  return { html, text, mentions: [...new Set(mentions)], firstImage: img ? img[1] : null, empty: !text && !/<(img|iframe|hr|table)/.test(html) };
}

/** A single line of plain text (titles, names): no tags, no line breaks. */
export function cleanLine(s: unknown, max = 200): string {
  const words = getSettings().wordFilter.filter(Boolean);
  return filterWords(
    String(s ?? "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max),
    words,
  );
}

/** Text as a paragraph of HTML (system messages, plain notes). */
export function textToHtml(s: string) {
  return `<p>${s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`;
}
