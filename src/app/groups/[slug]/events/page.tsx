import { requireUser } from "@/lib/auth";
import { canPostInGroup, canReadGroup, groupRow } from "@/lib/groups";
import { eventsBetween, feedToken } from "@/lib/events";
import { baseUrl } from "@/lib/url";
import { Calendar } from "@/components/events/Calendar";

export const dynamic = "force-dynamic";

export default async function GroupEvents({ params }: { params: Promise<{ slug: string }> }) {
  const u = await requireUser();
  const g = groupRow(decodeURIComponent((await params).slug));
  if (!g || !canReadGroup(u, g)) return null;
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const base = await baseUrl();
  const tok = feedToken(u.id);
  return (
    <Calendar
      initial={eventsBetween(u, first.getTime() - 7 * 86_400_000, first.getTime() + 42 * 86_400_000, { groupId: g.id })}
      feedUrl={{ mine: `${base}/cal/${tok}.ics`, all: `${base}/cal/${tok}.ics?all=1` }}
      canCreate={canPostInGroup(u, g)}
      groupId={g.id}
    />
  );
}
