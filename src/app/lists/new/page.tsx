import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { requestT } from "@/lib/t";
import { getSettings } from "@/lib/settings";
import { postableGroups } from "@/lib/groups";
import { ListForm } from "@/components/lists/ListForm";
import { BackPill } from "@/components/ui/BackPill";

export async function generateMetadata() {
  return { title: (await requestT())("New list") };
}

export default async function NewListPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const u = await requireUser();
  const s = getSettings();
  if (!s.features.lists) notFound();
  if (s.canCreate.lists === "mods" && !u.isMod) redirect("/lists");
  const { group } = await searchParams;
  const t = await requestT();
  return (
    <div className="page mid">
      <BackPill href="/lists" label={t("Lists")} />
      <div className="page-head">
        <div>
          <span className="eyebrow">{t("Lists")}</span>
          <h1 className="display page-title">{t("Make a list")}</h1>
        </div>
      </div>
      <div className="panel panel-pad">
        <ListForm groups={postableGroups(u)} groupId={group ? Number(group) : undefined} />
      </div>
    </div>
  );
}
