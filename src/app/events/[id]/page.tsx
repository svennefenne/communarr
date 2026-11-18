import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEvent } from "@/lib/events";
import { EventDetail } from "@/components/events/EventDetail";
import { BackPill } from "@/components/ui/BackPill";
import { requestT } from "@/lib/t";
import { cachedPreview, previewKey, type LinkPreview } from "@/lib/links";
import { linksIn } from "@/lib/linksIn";
import { baseUrl } from "@/lib/url";
import { bggMode } from "@/lib/bgg";
import { shelfAccount } from "@/lib/bggShelf";
import { broughtTo } from "@/lib/eventGames";
import { EventGames } from "@/components/events/EventGames";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const e = getEvent(u, Number((await params).id));
  return { title: e ? e.title : (await requestT())("Event") };
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const t = await requestT();
  const id = Number((await params).id);
  const e = getEvent(u, id);
  if (!e) notFound();
  // the previews of its links the site already has (the rest are fetched in the browser)
  const base = await baseUrl();
  const previews: Record<string, LinkPreview | null> = {};
  for (const url of linksIn(e.html)) {
    const kept = cachedPreview(previewKey(url, base) ?? "");
    if (kept !== undefined) previews[url] = kept;
  }
  // the games coming along: where game shelves are on, once there are any or the viewer has a shelf to bring from
  let games: React.ReactNode = null;
  if (bggMode() === "full" && !e.cancelled) {
    const list = broughtTo(u, e.id);
    const shelf = shelfAccount(u.id);
    const hasShelf = shelf?.status === "ok" && shelf.games > 0;
    const coming = e.author.id === u.id || e.mine === "going" || e.mine === "maybe";
    const over = e.repeat === "none" ? e.endAt < Date.now() : e.repeatUntil !== null && e.repeatUntil < Date.now();
    if (list.length || (hasShelf && !over))
      games = (
        <EventGames
          eventId={e.id}
          groupId={e.group?.id}
          list={list}
          coming={e.going.length}
          canBring={hasShelf && coming && !over}
          hint={hasShelf && !coming && !over ? t("Say you're coming, and you can bring games off your shelf.") : null}
        />
      );
  }
  return (
    <div className="page">
      <BackPill href="/calendar" label={t("Calendar")} />
      <EventDetail event={e} previews={previews} games={games} />
    </div>
  );
}
