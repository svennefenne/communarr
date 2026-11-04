import Link from "next/link";
import { notFound } from "next/navigation";
import { ListChecks, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { requestT } from "@/lib/t";
import { listLists } from "@/lib/lists";
import { getSettings } from "@/lib/settings";
import { ListCardView } from "@/components/lists/ListCard";
import { Empty } from "@/components/ui/ui";

export async function generateMetadata() {
  return { title: (await requestT())("Lists") };
}
export const dynamic = "force-dynamic";

const TABS = [
  ["all", "All lists"],
  ["todo", "To fill in"],
  ["mine", "Mine"],
] as const;

export default async function ListsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const u = await requireUser();
  const t = await requestT();
  const s = getSettings();
  if (!s.features.lists) notFound();
  const { tab: raw = "all" } = await searchParams;
  const tab = TABS.some(([id]) => id === raw) ? (raw as (typeof TABS)[number][0]) : "all";
  const lists = listLists(u, { tab });
  const canCreate = s.canCreate.lists === "members" || u.isMod;
  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <span className="eyebrow">{t("Fill in together")}</span>
          <h1 className="display page-title">{t("Lists")}</h1>
        </div>
        {canCreate ? (
          <div className="page-actions">
            <Link href="/lists/new" className="btn btn-primary">
              <Plus size={16} /> {t("New list")}
            </Link>
          </div>
        ) : null}
      </div>
      <nav className="tabs">
        {TABS.map(([id, label]) => (
          <Link key={id} href={`/lists?tab=${id}`} className={tab === id ? "active" : ""}>
            {t(label)}
          </Link>
        ))}
      </nav>
      <div className="stack loose">
        {lists.map((l) => (
          <ListCardView key={l.id} list={l} />
        ))}
        {!lists.length ? (
          <Empty icon={<ListChecks size={24} />} title={t(tab === "todo" ? "Nothing to fill in" : "No lists here")}>
            {canCreate ? (
              <Link href="/lists/new" className="link">
                {t("Make a list")}
              </Link>
            ) : null}
          </Empty>
        ) : null}
      </div>
    </div>
  );
}
