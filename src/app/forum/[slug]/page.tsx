import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Lock, MessagesSquare, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { canSeeCategory, categories, categoryRow, PAGE_SIZE, threads } from "@/lib/forum";
import { ThreadList } from "@/components/forum/ThreadList";
import { BackPill } from "@/components/ui/BackPill";
import { Empty } from "@/components/ui/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const c = categoryRow(decodeURIComponent((await params).slug));
  return { title: c ? `${c.name} · Forum` : "Forum" };
}

const SORTS = [
  ["active", "Active"],
  ["new", "Newest"],
  ["top", "Most replies"],
] as const;

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string; page?: string }> }) {
  const u = await requireUser();
  const c = categoryRow(decodeURIComponent((await params).slug));
  if (!c || !canSeeCategory(u, c)) notFound();
  const sp = await searchParams;
  const sort = (["active", "new", "top"].includes(sp.sort ?? "") ? sp.sort : "active") as "active" | "new" | "top";
  const page = Math.max(1, Number(sp.page) || 1);
  const { list, total } = threads(u, { categoryId: c.id, sort, page });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const info = categories(u).find((x) => x.id === c.id)!;
  const link = (o: { sort?: string; page?: number }) => `/forum/${c.slug}?sort=${o.sort ?? sort}${(o.page ?? 1) > 1 ? `&page=${o.page}` : ""}`;
  const canStart = !c.locked || u.isMod;
  return (
    <div className="page mid">
      <BackPill href="/forum" label="Forum" />
      <div className="page-head">
        <div className="row" style={{ gap: 16, alignItems: "flex-end" }}>
          <span className="cat-icon big" style={{ ["--cc" as string]: info.color }}>
            {info.icon || info.name.slice(0, 1)}
          </span>
          <div>
            <span className="eyebrow">Forum{info.group ? ` · ${info.group.name}` : ""}</span>
            <h1 className="display page-title">{c.name}</h1>
            {c.description ? <p className="dim" style={{ margin: "8px 0 0" }}>{c.description}</p> : null}
          </div>
        </div>
        <div className="page-actions">
          {canStart ? (
            <Link href={`/forum/new?cat=${c.id}`} className="btn btn-primary">
              <Plus size={16} /> New thread
            </Link>
          ) : (
            <span className="pill">
              <Lock size={13} /> Moderators start threads here
            </span>
          )}
        </div>
      </div>
      <div className="row between wrap" style={{ marginBottom: 14 }}>
        <div className="pills">
          {SORTS.map(([id, label]) => (
            <Link key={id} href={link({ sort: id })} className={`pill ${sort === id ? "active" : ""}`}>
              {label}
            </Link>
          ))}
        </div>
        <span className="small muted">
          {total} {total === 1 ? "thread" : "threads"}
        </span>
      </div>
      {list.length ? (
        <ThreadList threads={list} />
      ) : (
        <div className="panel">
          <Empty icon={<MessagesSquare size={24} />} title="No threads here yet">
            {canStart ? (
              <Link href={`/forum/new?cat=${c.id}`} className="link">
                Start the first one
              </Link>
            ) : null}
          </Empty>
        </div>
      )}
      {pages > 1 ? (
        <nav className="pager" aria-label="Pages">
          {page > 1 ? (
            <Link href={link({ page: page - 1 })} className="btn btn-sm">
              <ChevronLeft size={15} /> Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="small muted">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={link({ page: page + 1 })} className="btn btn-sm">
              Older <ChevronRight size={15} />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
