/**
 * The links in written text (saved HTML) that can have a preview: http(s) links, not mentions or games, each
 * once, the first few. (The HTML has been through cleanHtml, so attributes are in double quotes.)
 */
export function linksIn(html: string, max = 3): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<a\s([^>]*)>/gi)) {
    const attrs = m[1];
    // (not mentions, nor board games: those have a card of their own)
    if (/class="[^"]*\b(mention|bgg-game)\b/.test(attrs)) continue;
    const href = /href="([^"]+)"/.exec(attrs)?.[1]?.replace(/&amp;/g, "&");
    if (!href || !/^https?:\/\//i.test(href) || out.includes(href)) continue;
    out.push(href);
    if (out.length >= max) break;
  }
  return out;
}
