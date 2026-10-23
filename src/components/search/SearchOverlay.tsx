"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, X } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import type { SearchHit, SearchKind } from "@/lib/search";
import { HitRow, KIND_NAMES } from "./SearchResults";

const ORDER: SearchKind[] = ["user", "group", "room", "news", "post", "thread", "event", "poll", "reply", "comment", "message"];

/** Search everything, as you type (the header's search, "/" or Ctrl+K). */
export function SearchOverlay() {
  const { search, closeSearch } = useApp();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [counts, setCounts] = useState<Partial<Record<SearchKind, number>>>({});
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!search.open) return;
    setQ(search.query);
    setHits(null);
    setTimeout(() => input.current?.focus(), 30);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeSearch();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [search.open, search.query, closeSearch]);

  useEffect(() => {
    if (!search.open) return;
    const term = q.trim();
    if (term.length < 2) {
      setHits(null);
      return;
    }
    setBusy(true);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}&limit=30`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((d) => {
          setHits(d.hits);
          setCounts(d.counts);
        })
        .catch(() => {})
        .finally(() => setBusy(false));
    }, 180);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, search.open]);

  if (!search.open) return null;
  const grouped = ORDER.map((k) => [k, (hits ?? []).filter((h) => h.kind === k)] as const).filter(([, list]) => list.length);
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const all = () => router.push(`/search?q=${encodeURIComponent(q.trim())}`);

  return createPortal(
    <div className="modal-back search-back" onMouseDown={(e) => e.target === e.currentTarget && closeSearch()}>
      <div className="panel search-panel" role="dialog" aria-modal="true" aria-label="Search">
        <form
          className="search-bar"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) all();
          }}
        >
          <Search size={20} className={busy ? "pulse" : ""} />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search posts, forum, chat, events, people…" aria-label="Search" enterKeyHint="search" />
          <button type="button" className="icon-btn sm" onClick={closeSearch} aria-label="Close">
            <X size={18} />
          </button>
        </form>
        <div className="search-scroll">
          {hits === null ? (
            <div className="empty small">
              Type at least two letters. Everything you can see is searched: posts, news, comments, the forum, polls, events, chat rooms you&apos;re in, groups and members.
            </div>
          ) : !hits.length ? (
            <div className="empty small">Nothing found for &ldquo;{q}&rdquo;.</div>
          ) : (
            grouped.map(([k, list]) => (
              <div key={k}>
                <div className="menu-label" style={{ padding: "12px 16px 4px" }}>
                  {KIND_NAMES[k]} <span className="faint">· {counts[k]}</span>
                </div>
                <div className="list">
                  {list.slice(0, 5).map((h) => (
                    <HitRow key={`${h.kind}-${h.ref}`} h={h} onPick={closeSearch} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        {hits?.length ? (
          <button type="button" className="search-all" onClick={all}>
            See all {total} results <ArrowRight size={16} />
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
