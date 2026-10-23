import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, UsersRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listGroups, type GroupInfo } from "@/lib/groups";
import { getSettings } from "@/lib/settings";
import { Empty } from "@/components/ui/ui";

export const metadata = { title: "Groups" };
export const dynamic = "force-dynamic";

function GroupCard({ g }: { g: GroupInfo }) {
  return (
    <Link href={`/groups/${g.slug}`} className="panel group-card hoverable" style={{ ["--gc" as string]: g.color }}>
      <span className="group-card-banner" style={g.banner ? { backgroundImage: `url("${g.banner}")` } : undefined} />
      <span className="group-card-body">
        <span className="group-avatar" style={{ width: 52, height: 52, fontSize: 22, backgroundImage: g.avatar ? `url("${g.avatar}")` : undefined }}>
          {g.avatar ? "" : g.name.slice(0, 1)}
        </span>
        <span className="grow" style={{ minWidth: 0 }}>
          <b className="h3 ellipsis" style={{ display: "block" }}>
            {g.name}
          </b>
          <span className="small dim clamp-2">{g.tagline || " "}</span>
          <span className="tiny muted row" style={{ gap: 8, marginTop: 6 }}>
            <span>
              {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
            </span>
            <span className="badge">{g.privacy}</span>
            {g.myRole === "owner" || g.myRole === "admin" ? <span className="badge accent">{g.myRole}</span> : null}
            {g.request === "invite" ? <span className="badge hot">Invited</span> : g.request === "request" ? <span className="badge">Asked</span> : null}
          </span>
        </span>
      </span>
    </Link>
  );
}

export default async function GroupsPage() {
  const u = await requireUser();
  const s = getSettings();
  if (!s.features.groups) notFound();
  const { mine, others } = listGroups(u);
  const canCreate = s.canCreate.groups === "members" || u.isMod;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Your corners</span>
          <h1 className="display page-title">Groups</h1>
        </div>
        {canCreate ? (
          <div className="page-actions">
            <Link href="/groups/new" className="btn btn-primary">
              <Plus size={16} /> New group
            </Link>
          </div>
        ) : null}
      </div>
      <div className="stack loose">
        <section className="stack">
          <span className="eyebrow">Yours · {mine.length}</span>
          {mine.length ? (
            <div className="cards">
              {mine.map((g) => (
                <GroupCard key={g.id} g={g} />
              ))}
            </div>
          ) : (
            <div className="panel">
              <Empty icon={<UsersRound size={24} />} title="You're not in any groups yet">
                Join one below{canCreate ? " or start your own" : ""}.
              </Empty>
            </div>
          )}
        </section>
        {others.length ? (
          <section className="stack">
            <span className="eyebrow">Discover · {others.length}</span>
            <div className="cards">
              {others.map((g) => (
                <GroupCard key={g.id} g={g} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
