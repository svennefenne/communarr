import Link from "next/link";
import { Dices } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { canReadGroup, groupMembers, groupRole, groupRow } from "@/lib/groups";
import { bggMode } from "@/lib/bgg";
import { groupShelf, shelfAccount } from "@/lib/bggShelf";
import { GameShelf } from "@/components/profile/GameShelf";
import { GroupColumns } from "@/components/groups/GroupColumns";
import { Empty } from "@/components/ui/ui";
import { requestT } from "@/lib/t";

export const dynamic = "force-dynamic";

/** A group's game shelf: every board game its members own on BoardGameGeek, and who has it (lib/bggShelf.ts). */
export default async function GroupGames({ params }: { params: Promise<{ slug: string }> }) {
  const u = await requireUser();
  const t = await requestT();
  const g = groupRow(decodeURIComponent((await params).slug));
  if (!g || !canReadGroup(u, g)) return null;
  const { games, owners } = groupShelf(g.id);
  // the members with games, in the group's own order
  const owning = new Set(Object.values(owners).flat());
  const people = groupMembers(g.id)
    .filter((m) => owning.has(m.user.id))
    .map(({ user: p }) => ({ id: p.id, name: p.name, avatar: p.avatar, accent: p.accent }));
  // in the group, with no shelf of their own yet: how to add theirs
  const yours = !!groupRole(g.id, u.id) && bggMode() === "full" && !shelfAccount(u.id);
  return (
    <GroupColumns u={u} g={g}>
      <div className="stack">
        {yours ? (
          <p className="panel panel-pad small row wrap" style={{ margin: 0, gap: 8 }}>
            <Dices size={16} className="muted" aria-hidden />
            <span className="grow">{t("Your games aren't here yet: give your name on BoardGameGeek and they join the group's shelf.")}</span>
            <Link href="/settings" className="btn btn-sm">
              {t("Link BoardGameGeek")}
            </Link>
          </p>
        ) : null}
        {games.length ? (
          <GameShelf games={games} whose={{ kind: "group", people, owners }} />
        ) : (
          <Empty icon={<Dices size={28} />} title={t("No games on the shelf yet")}>
            {t("When members link their BoardGameGeek collections, the games they own turn up here.")}
          </Empty>
        )}
      </div>
    </GroupColumns>
  );
}
