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

/** The links in written text to things on the site itself (/forum/t/12): not mentions or pictures, each once, the first few. */
export function siteLinksIn(html: string, max = 3): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<a\s([^>]*)>/gi)) {
    const attrs = m[1];
    if (/class="[^"]*\bmention\b/.test(attrs)) continue;
    const href = /href="([^"]+)"/.exec(attrs)?.[1]?.replace(/&amp;/g, "&");
    if (!href || !/^\/(?!\/|media\/)/.test(href) || out.includes(href)) continue;
    out.push(href);
    if (out.length >= max) break;
  }
  return out;
}
