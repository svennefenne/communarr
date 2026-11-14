import Link from "next/link";
import { notFound } from "next/navigation";
import { MessagesSquare, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { categories, threads } from "@/lib/forum";
import { getSettings } from "@/lib/settings";
import { ThreadList } from "@/components/forum/ThreadList";
import { ForumCategories, ForumView, ForumViewToggle } from "@/components/forum/ForumIndex";
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
      <ForumView initial={u.theme.forumView}>
        <div className="page-head">
          <div>
            <span className="eyebrow">{t("Talk it through")}</span>
            <h1 className="display page-title">{t("Forum")}</h1>
          </div>
          <div className="page-actions">
            <ForumViewToggle />
            <Link href="/forum/new" className="btn btn-primary">
              <Plus size={16} /> {t("New thread")}
            </Link>
          </div>
        </div>
        <div className="with-side">
          <div className="stack loose" style={{ minWidth: 0 }}>
            <ForumCategories cats={cats} />
          </div>
          {/* one panel, its name inside: its top is level with the categories' */}
          <aside className="stack">
            <section className="panel">
              <div className="panel-head">
                <span className="eyebrow">{t("Latest activity")}</span>
              </div>
              {latest.length ? (
                <ThreadList threads={latest} showCategory bare />
              ) : (
                <Empty icon={<MessagesSquare size={24} />} title={t("No threads yet")}>
                  <Link href="/forum/new" className="link">
                    {t("Start the first one")}
                  </Link>
                </Empty>
              )}
            </section>
          </aside>
        </div>
      </ForumView>
    </div>
  );
}
