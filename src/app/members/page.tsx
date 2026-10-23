import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { summary, type UserRow } from "@/lib/users";
import { MemberGrid } from "@/components/profile/MemberGrid";

export const metadata = { title: "Members" };
export const dynamic = "force-dynamic";

export default async function MembersPage() {
  await requireUser();
  const rows = db().prepare("select * from users where banned = 0 and (ban_reason is null or ban_reason != 'pending') order by display_name collate nocase").all() as UserRow[];
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">The crew</span>
          <h1 className="display page-title">Members</h1>
        </div>
      </div>
      <MemberGrid members={rows.map((r) => ({ ...summary(r), pronouns: r.pronouns }))} />
    </div>
  );
}
