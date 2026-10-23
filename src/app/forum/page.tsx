import Link from "next/link";
import { notFound } from "next/navigation";
import { MessagesSquare, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { categories, threads } from "@/lib/forum";
import { getSettings } from "@/lib/settings";
import { ThreadList } from "@/components/forum/ThreadList";
import { Time } from "@/components/ui/Time";
import { Empty } from "@/components/ui/ui";
import { requestT } from "@/lib/t";

export async function generateMetadata() {
  return { title: (await requestT())("Forum") };
}
export const dynamic = "force-dynamic";

export default async function ForumPage() {
  const u = await requireUser();
  const t = await requestT();
  if (!getSettings().features.forum) notFound();
  const cats = categories(u);
  const latest = threads(u, { sort: "active", limit: 12 }).list;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">{t("Talk it through")}</span>
          <h1 className="display page-title">{t("Forum")}</h1>
        </div>
        <div className="page-actions">
          <Link href="/forum/new" className="btn btn-primary">
            <Plus size={16} /> {t("New thread")}
          </Link>
        </div>
      </div>
      <div className="with-side">
        <div className="stack loose" style={{ minWidth: 0 }}>
          <div className="cat-grid">
            {cats.map((c) => (
              <Link key={c.id} href={`/forum/${c.slug}`} className="panel cat-card hoverable" style={{ ["--cc" as string]: c.color }}>
                <span className="cat-icon">{c.icon || c.name.slice(0, 1)}</span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="row" style={{ gap: 8 }}>
                    <b className="h3">{c.name}</b>
                    {c.unread ? <span className="badge hot">{t.n(c.unread, "1 new", "{n} new")}</span> : null}
                    {c.group ? <span className="badge teal">{c.group.name}</span> : null}
                  </span>
                  <span className="small dim clamp-2">{c.description}</span>
                  <span className="tiny muted" style={{ display: "block", marginTop: 6 }}>
                    {t.n(c.threads, "{n} thread", "{n} threads")} · {t.n(c.posts, "{n} post", "{n} posts")}
                    {c.last ? (
                      <>
                        {" "}
                        · {t("last:")} <span className="dim">{c.last.title}</span> <Time t={c.last.at} />
                      </>
                    ) : null}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
        <aside className="stack">
          <div className="row between">
            <span className="eyebrow">{t("Latest activity")}</span>
          </div>
          {latest.length ? (
            <ThreadList threads={latest} showCategory />
          ) : (
            <div className="panel">
              <Empty icon={<MessagesSquare size={24} />} title={t("No threads yet")}>
                <Link href="/forum/new" className="link">
                  {t("Start the first one")}
                </Link>
              </Empty>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
