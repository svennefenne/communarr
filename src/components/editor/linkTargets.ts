"use client";

import { useEffect, useState } from "react";
import type { SearchHit, SearchKind } from "@/lib/search";

/** What's typed in the editor's Link: an address to go to as it is, or else words to look for on the site. */
export const isAddress = (s: string) => /^(https?:|mailto:|tel:|\/)/i.test(s) || /^[^\s/@]+\.[a-z]{2,}(\/\S*)?$/i.test(s) || /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(s);

/** A hit's title without the search words marked. */
export const plainTitle = (s: string) => s.replace(/[\u0001\u0002]/g, "");

export interface LinkFound {
  hits: SearchHit[];
  categories: { name: string; url: string }[];
}

/** What there is on the site to link to for what's typed ("": the latest); null: not looking. */
export function useLinkSearch(q: string | null): { found: LinkFound | null; busy: boolean } {
  const [found, setFound] = useState<LinkFound | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q === null) return;
    setBusy(true);
    const ctl = new AbortController();
    const timer = setTimeout(
      () => {
        fetch(`/api/search/link?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
          .then((r) => r.json())
          .then((d: LinkFound) => setFound(d))
          .catch(() => {})
          .finally(() => !ctl.signal.aborted && setBusy(false));
      },
      q ? 160 : 0,
    );
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [q]);
  return { found, busy };
}

export type LinkTarget = { kind: SearchKind; title: string; text: string } | null;
const targets = new Map<string, Promise<LinkTarget>>();

/** What a link on the site (/forum/t/12) points at, if it's something you may see (asked once a page load). */
export function loadTarget(href: string): Promise<LinkTarget> {
  if (!targets.has(href))
    targets.set(
      href,
      fetch(`/api/search/link?url=${encodeURIComponent(href)}`)
        .then((r) => r.json())
        .then((d: { target: LinkTarget }) => d.target ?? null)
        .catch(() => null),
    );
  return targets.get(href)!;
}

export function useLinkTarget(href: string): LinkTarget {
  const [target, setTarget] = useState<LinkTarget>(null);
  useEffect(() => {
    setTarget(null);
    if (!href.startsWith("/") || href.startsWith("//")) return;
    let on = true;
    void loadTarget(href).then((x) => on && setTarget(x));
    return () => {
      on = false;
    };
  }, [href]);
  return target;
}
