"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { LinkPreview } from "@/lib/links";
import { linksIn, siteLinksIn } from "@/lib/linksIn";
import { bggIdOf } from "@/lib/bggUrl";
import { useSite, useT } from "@/components/app/AppProvider";
import { KIND_ICON, KIND_ONE } from "@/components/search/SearchResults";
import { loadTarget, type LinkTarget } from "@/components/editor/linkTargets";
import { GameLinkCard } from "./bggCards";

/**
 * Previews of the links in written text (under every RichText, and under an event's details as
 * they're written): a page's title, text and picture, or the picture a link is. The site fetches
 * them (/api/link-preview) and keeps them a while.
 */

// cards come after the text is drawn: "hd:grew" lets a chat that was at its bottom stay there
const grew = () => window.dispatchEvent(new Event("hd:grew"));

// one request per link while the page is open, however many show it
const asked = new Map<string, Promise<LinkPreview | null>>();
export function loadPreview(url: string): Promise<LinkPreview | null> {
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
  // links to things on the site (a shared post, a thread): what they are, if you may see them
  const own = useMemo(() => siteLinksIn(html, max), [html, max]);
  // a link to a game on BoardGameGeek: its card from BGG's API (BGG turns away fetching its pages)
  const bgg = useSite().bgg === "full";
  const game = useCallback((u: string) => (bgg ? bggIdOf(u) : null), [bgg]);
  const [got, setGot] = useState<Record<string, LinkPreview | null>>(initial ?? {});
  const [targets, setTargets] = useState<Record<string, LinkTarget>>({});
  useEffect(() => {
    let live = true;
    for (const u of urls) if (!game(u)) void loadPreview(u).then((p) => live && setGot((x) => (u in x && x[u]?.title === p?.title ? x : { ...x, [u]: p })));
    for (const u of own) void loadTarget(u).then((x) => live && setTargets((t) => (t[u] === x ? t : { ...t, [u]: x })));
    return () => {
      live = false;
    };
  }, [urls, own, game]);
  const shown = urls.filter((u) => game(u) || got[u]);
  const ownShown = own.filter((u) => targets[u]);
  useLayoutEffect(() => {
    if (shown.length || ownShown.length) grew();
  }, [shown.length, ownShown.length]);
  if (!shown.length && !ownShown.length) return null;
  return (
    <div className="link-previews">
      {ownShown.map((u) => (
        <SiteCard key={u} href={u} target={targets[u]!} />
      ))}
      {shown.map((u) => {
        const id = game(u);
        return id ? <GameLinkCard key={u} id={id} url={u} /> : <LinkCard key={u} p={got[u]!} />;
      })}
    </div>
  );
}

/** A link to something on the site: what kind of thing, its name and how it starts. */
function SiteCard({ href, target }: { href: string; target: NonNullable<LinkTarget> }) {
  const t = useT();
  const Icon = KIND_ICON[target.kind];
  return (
    <Link className="link-card site-card" href={href}>
      <span className="hit-icon">
        <Icon size={16} />
      </span>
      <span className="link-card-text">
        <span className="link-card-site">{t(KIND_ONE[target.kind])}</span>
        <b className="link-card-title">{target.title}</b>
        {target.text && target.text !== target.title ? <span className="link-card-desc">{target.text}</span> : null}
      </span>
    </Link>
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
