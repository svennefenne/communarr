import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { feed } from "@/lib/feed";
import { getSettings } from "@/lib/settings";
import { Feed } from "@/components/feed/Feed";

export const metadata = { title: "News" };
export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const u = await requireUser();
  if (!getSettings().features.news) notFound();
  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <span className="eyebrow">From the admins</span>
          <h1 className="display page-title">News</h1>
        </div>
      </div>
      <Feed initial={feed(u, { filter: "news" })} initialFilter="news" groups={[]} composer={u.isMod} showFilters={false} />
    </div>
  );
}
