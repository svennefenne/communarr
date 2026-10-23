import { Bookmark } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { requestT } from "@/lib/t";
import { db } from "@/lib/db";
import { canSeePost, postRow, toPostViews } from "@/lib/posts";
import { canSeeThread, threadRow, toThreadCards } from "@/lib/forum";
import { canSeePoll, pollRow, toPollViews } from "@/lib/polls";
import { canSeeEvent, eventRow, toEventViews } from "@/lib/events";
import { PostCard } from "@/components/feed/PostCard";
import { PollCard } from "@/components/feed/PollCard";
import { EventCard } from "@/components/feed/EventCard";
import { ThreadList } from "@/components/forum/ThreadList";
import { Empty } from "@/components/ui/ui";

export async function generateMetadata() {
  return { title: (await requestT())("Saved") };
}
export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const u = await requireUser();
  const tr = await requestT();
  const rows = db().prepare("select target_type t, target_id id from bookmarks where user_id = ? order by created_at desc").all(u.id) as { t: string; id: number }[];
  const items = rows
    .map((r) => {
      if (r.t === "post") {
        const p = postRow(r.id);
        return p && canSeePost(u, p) ? <PostCard key={`p${r.id}`} post={toPostViews(u, [p])[0]} /> : null;
      }
      if (r.t === "thread") {
        const t = threadRow(r.id);
        return t && canSeeThread(u, t) ? <ThreadList key={`t${r.id}`} threads={toThreadCards(u, [t])} showCategory /> : null;
      }
      if (r.t === "poll") {
        const p = pollRow(r.id);
        return p && canSeePoll(u, p) ? <PollCard key={`v${r.id}`} poll={toPollViews(u, [p])[0]} /> : null;
      }
      if (r.t === "event") {
        const e = eventRow(r.id);
        return e && canSeeEvent(u, e) ? <EventCard key={`e${r.id}`} event={toEventViews(u, [e])[0]} /> : null;
      }
      return null;
    })
    .filter(Boolean);
  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <span className="eyebrow">{tr("For later")}</span>
          <h1 className="display page-title">{tr("Saved")}</h1>
        </div>
      </div>
      <div className="stack loose">{items.length ? items : <Empty icon={<Bookmark size={24} />} title={tr("Nothing saved")}>{tr("Use “Save for later” in a post's ⋯ menu (or on a thread, poll or event) to keep it here.")}</Empty>}</div>
    </div>
  );
}
