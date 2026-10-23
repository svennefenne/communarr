import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { categories } from "@/lib/forum";
import { getSettings } from "@/lib/settings";
import { canPostInGroup, groupRow } from "@/lib/groups";
import { NewThreadForm } from "@/components/forum/NewThreadForm";
import { BackPill } from "@/components/ui/BackPill";
import { requestT } from "@/lib/t";

export async function generateMetadata() {
  return { title: (await requestT())("New thread") };
}

export default async function NewThreadPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const u = await requireUser();
  const t = await requestT();
  if (!getSettings().features.forum) notFound();
  const { cat } = await searchParams;
  const cats = categories(u).filter((c) => (!c.locked || u.isMod) && (!c.group || canPostInGroup(u, groupRow(c.group.id)!)));
  return (
    <div className="page mid">
      <BackPill href="/forum" label={t("Forum")} />
      <div className="page-head">
        <div>
          <span className="eyebrow">{t("Forum")}</span>
          <h1 className="display page-title">{t("New thread")}</h1>
        </div>
      </div>
      <div className="panel panel-pad">
        <NewThreadForm cats={cats.map((c) => ({ id: c.id, name: c.name, icon: c.icon, locked: c.locked }))} initialCat={cat ? Number(cat) : undefined} />
      </div>
    </div>
  );
}
