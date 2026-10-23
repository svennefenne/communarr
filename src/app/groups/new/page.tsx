import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { GroupForm } from "@/components/groups/GroupForm";
import { BackPill } from "@/components/ui/BackPill";
import { requestT } from "@/lib/t";

export async function generateMetadata() {
  return { title: (await requestT())("New group") };
}

export default async function NewGroupPage() {
  const u = await requireUser();
  const t = await requestT();
  const s = getSettings();
  if (!s.features.groups) notFound();
  if (s.canCreate.groups === "mods" && !u.isMod) redirect("/groups");
  return (
    <div className="page mid">
      <BackPill href="/groups" label={t("Groups")} />
      <div className="page-head">
        <div>
          <span className="eyebrow">{t("Groups")}</span>
          <h1 className="display page-title">{t("Start a group")}</h1>
        </div>
      </div>
      <div className="panel panel-pad">
        <GroupForm />
      </div>
    </div>
  );
}
