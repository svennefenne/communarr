import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { requestT } from "@/lib/t";
import { feed } from "@/lib/feed";
import { getSettings } from "@/lib/settings";
import { Feed } from "@/components/feed/Feed";

export async function generateMetadata() {
  return { title: (await requestT())("News") };
}
export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const u = await requireUser();
  if (!getSettings().features.news) notFound();
  const t = await requestT();
  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <span className="eyebrow">{t("From the admins")}</span>
          <h1 className="display page-title">{t("News")}</h1>
        </div>
      </div>
      <Feed initial={feed(u, { filter: "news" })} initialFilter="news" groups={[]} composer={u.isMod} showFilters={false} />
    </div>
  );
}
