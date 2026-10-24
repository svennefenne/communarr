import { requireUser } from "@/lib/auth";
import { canReadGroup, groupInfo, groupRow } from "@/lib/groups";
import { RichText } from "@/components/content/RichText";
import { Time } from "@/components/ui/Time";
import { PRIVACY } from "@/components/groups/privacy";
import { requestT } from "@/lib/t";
import { GroupColumns } from "@/components/groups/GroupColumns";

export const dynamic = "force-dynamic";

export default async function GroupAbout({ params }: { params: Promise<{ slug: string }> }) {
  const u = await requireUser();
  const t = await requestT();
  const row = groupRow(decodeURIComponent((await params).slug));
  if (!row || !canReadGroup(u, row)) return null;
  const g = groupInfo(u, row);
  return (
    <GroupColumns u={u} g={row}>
      <div className="panel panel-pad">{g.descriptionHtml ? <RichText html={g.descriptionHtml} /> : <p className="muted">{t("No description yet.")}</p>}</div>
      <div className="panel panel-pad small stack tight">
        <span>
          <b>{t(PRIVACY[g.privacy].label)}:</b> <span className="muted">{t(PRIVACY[g.privacy].text)}</span>
        </span>
        <span className="muted">
          {t("Started")} <Time t={g.createdAt} mode="date" />
        </span>
      </div>
    </GroupColumns>
  );
}
