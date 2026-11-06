/** Written text (saved HTML) as its words on one line: for an excerpt, or for saying which post is meant. */
export const plainText = (html: string) =>
  html
    // (a space where a paragraph, line or item ends; none where bold or a link does: "**Hi**!" is "Hi!")
    .replace(/<\/(p|h\d|li|blockquote|pre|div|td|th)>|<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
