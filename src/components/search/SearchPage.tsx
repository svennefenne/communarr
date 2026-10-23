"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { SearchHit, SearchKind } from "@/lib/search";
import { Empty } from "@/components/ui/ui";
import { HitRow } from "./SearchResults";
import { useT } from "@/components/app/AppProvider";

export function SearchPage({ hits, q, page, pages, kind }: { hits: SearchHit[]; q: string; page: number; pages: number; kind?: SearchKind }) {
  const t = useT();
  const link = (p: number) => `/search?q=${encodeURIComponent(q)}${kind ? `&kind=${kind}` : ""}${p > 1 ? `&page=${p}` : ""}`;
  if (!hits.length)
    return (
      <div className="panel">
        <Empty icon={<Search size={24} />} title={t("Nothing found")}>
          {t("Try fewer or different words. The last word also matches the start of words (“pizz” finds pizza).")}
        </Empty>
      </div>
    );
  return (
    <>
      <div className="panel list">
        {hits.map((h) => (
          <HitRow key={`${h.kind}-${h.ref}`} h={h} />
        ))}
      </div>
      {pages > 1 ? (
        <nav className="pager">
          {page > 1 ? (
            <Link href={link(page - 1)} className="btn btn-sm">
              <ChevronLeft size={15} /> {t("Back")}
            </Link>
          ) : (
            <span />
          )}
          <span className="small muted">
            {t("Page {page} of {pages}", { page, pages })}
          </span>
          {page < pages ? (
            <Link href={link(page + 1)} className="btn btn-sm">
              {t("More")} <ChevronRight size={15} />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
