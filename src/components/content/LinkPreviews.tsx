"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { LinkPreview } from "@/lib/links";
import { linksIn } from "@/lib/linksIn";

/**
 * Previews of the links in written text (under every RichText, and under an event's details as
 * they're written): a page's title, text and picture, or the picture a link is. The site fetches
 * them (/api/link-preview) and keeps them a while.
 */

// cards come after the text is drawn: "hd:grew" lets a chat that was at its bottom stay there
const grew = () => window.dispatchEvent(new Event("hd:grew"));

// one request per link while the page is open, however many show it
const asked = new Map<string, Promise<LinkPreview | null>>();
function load(url: string): Promise<LinkPreview | null> {
  let p = asked.get(url);
  if (!p) {
    p = fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => r.json() as Promise<{ preview?: LinkPreview | null; later?: boolean }>)
      .then((d) => {
        if (d.later) asked.delete(url); // too many just now: ask again next time
        return d.preview ?? null;
      })
      .catch(() => {
        asked.delete(url);
        return null;
      });
    asked.set(url, p);
  }
  return p;
}

export function LinkPreviews({ html, initial, max = 3 }: { html: string; initial?: Record<string, LinkPreview | null>; max?: number }) {
  const urls = useMemo(() => linksIn(html, max), [html, max]);
  const [got, setGot] = useState<Record<string, LinkPreview | null>>(initial ?? {});
  useEffect(() => {
    let live = true;
    for (const u of urls) void load(u).then((p) => live && setGot((x) => (u in x && x[u]?.title === p?.title ? x : { ...x, [u]: p })));
    return () => {
      live = false;
    };
  }, [urls]);
  const shown = urls.map((u) => got[u]).filter((p): p is LinkPreview => !!p);
  useLayoutEffect(() => {
    if (shown.length) grew();
  }, [shown.length]);
  if (!shown.length) return null;
  return (
    <div className="link-previews">
      {shown.map((p) => (
        <LinkCard key={p.url} p={p} />
      ))}
    </div>
  );
}

function LinkCard({ p }: { p: LinkPreview }) {
  const rel = "noopener noreferrer nofollow ugc";
  if (p.kind === "image" && p.image)
    return (
      <a className="link-card pic-only" href={p.url} target="_blank" rel={rel} title={p.url}>
        <img src={p.image} alt={p.title} loading="lazy" onLoad={grew} />
      </a>
    );
  return (
    <a className={`link-card ${p.image ? "" : "no-pic"}`} href={p.url} target="_blank" rel={rel}>
      {p.image ? <img className="link-card-pic" src={p.image} alt="" loading="lazy" /> : null}
      <span className="link-card-text">
        <span className="link-card-site">{p.site}</span>
        {p.title ? <b className="link-card-title">{p.title}</b> : null}
        {p.description ? <span className="link-card-desc">{p.description}</span> : null}
      </span>
    </a>
  );
}
