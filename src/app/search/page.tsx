import Link from "next/link";
import { Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { search, KIND_LABEL, type SearchKind } from "@/lib/search";
import { SearchPage } from "@/components/search/SearchPage";

export const metadata = { title: "Search" };
export const dynamic = "force-dynamic";

export default async function SearchRoute({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string; page?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const q = (sp.q || "").slice(0, 200);
  const kind = sp.kind && sp.kind in KIND_LABEL ? (sp.kind as SearchKind) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const all = q ? search(u.id, q, { limit: 1 }) : { hits: [], counts: {} };
  const res = q ? search(u.id, q, { kinds: kind ? [kind] : undefined, limit: 30, offset: (page - 1) * 30 }) : { hits: [], counts: {} };
  const total = Object.values(all.counts).reduce((a, b) => a + (b ?? 0), 0);
  const shown = kind ? all.counts[kind] ?? 0 : total;
  return (
    <div className="page mid">
      <div className="page-head">
        <div>
          <span className="eyebrow">Search everything</span>
          <h1 className="display page-title">{q ? `“${q}”` : "Search"}</h1>
        </div>
      </div>
      <form action="/search" className="search-bar panel" style={{ borderRadius: "var(--radius)", marginBottom: 16 }}>
        <Search size={20} />
        <input name="q" defaultValue={q} placeholder="Posts, forum, chat, events, polls, people…" autoFocus={!q} enterKeyHint="search" />
        {kind ? <input type="hidden" name="kind" value={kind} /> : null}
        <button type="submit" className="btn btn-primary btn-sm">
          Search
        </button>
      </form>
      {q ? (
        <>
          <nav className="tabs">
            <Link href={`/search?q=${encodeURIComponent(q)}`} className={!kind ? "active" : ""}>
              All <span className="n">{total}</span>
            </Link>
            {(Object.keys(all.counts) as SearchKind[]).map((k) => (
              <Link key={k} href={`/search?q=${encodeURIComponent(q)}&kind=${k}`} className={kind === k ? "active" : ""}>
                {KIND_LABEL[k]} <span className="n">{all.counts[k]}</span>
              </Link>
            ))}
          </nav>
          <SearchPage hits={res.hits} q={q} page={page} pages={Math.max(1, Math.ceil(shown / 30))} kind={kind} />
        </>
      ) : (
        <p className="muted">Type a word or two. Everything you can see is searched: posts, news, comments, forum threads and replies, polls, events, the chat rooms you&apos;re in, groups and members.</p>
      )}
    </div>
  );
}
