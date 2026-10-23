import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { canSeeGroup, groupInfo, groupRow } from "@/lib/groups";
import { getSettings } from "@/lib/settings";
import { GroupHeader } from "@/components/groups/GroupHeader";
import { BackPill } from "@/components/ui/BackPill";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const u = await requireUser();
  const g = groupRow(decodeURIComponent((await params).slug));
  return { title: g && canSeeGroup(u, g) ? g.name : "Group" };
}

export default async function GroupLayout({ params, children }: { params: Promise<{ slug: string }>; children: React.ReactNode }) {
  const u = await requireUser();
  const s = getSettings();
  const row = groupRow(decodeURIComponent((await params).slug));
  if (!row || !canSeeGroup(u, row) || !s.features.groups) notFound();
  const info = groupInfo(u, row, true);
  // outside a closed group you see its name, not what's said in it or who's in it
  const g = info.canRead ? info : { ...info, descriptionHtml: "", members: [] };
  return (
    <div className="page">
      <BackPill href="/groups" label="Groups" />
      <GroupHeader g={g} features={{ calendar: s.features.calendar, polls: s.features.polls, chat: s.features.chat }} />
      {g.canRead ? (
        children
      ) : (
        <div className="panel panel-pad row" style={{ marginTop: 18 }}>
          <Lock size={20} className="muted" />
          <div>
            <b>This group is closed.</b>
            <div className="small muted">Ask to join to see what&apos;s inside.</div>
          </div>
        </div>
      )}
    </div>
  );
}
