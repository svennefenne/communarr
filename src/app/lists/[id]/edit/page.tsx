import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { requestT } from "@/lib/t";
import { getList } from "@/lib/lists";
import { getSettings } from "@/lib/settings";
import { ListForm } from "@/components/lists/ListForm";
import { BackPill } from "@/components/ui/BackPill";

export async function generateMetadata() {
  return { title: (await requestT())("Edit the list") };
}

export default async function EditListPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  if (!getSettings().features.lists) notFound();
  const id = Number((await params).id);
  const l = getList(u, id);
  if (!l) notFound();
  if (!l.canEdit) redirect(`/lists/${id}`);
  const t = await requestT();
  return (
    <div className="page mid">
      <BackPill href={`/lists/${id}`} />
      <div className="page-head">
        <div>
          <span className="eyebrow">{t("Lists")}</span>
          <h1 className="display page-title">{t("Edit the list")}</h1>
        </div>
      </div>
      <div className="panel panel-pad">
        <ListForm groups={[]} list={l} />
      </div>
    </div>
  );
}
