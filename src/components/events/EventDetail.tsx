"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, CalendarPlus, Clock, Lock, MapPin, Repeat, RotateCcw, Users } from "lucide-react";
import type { EventView } from "@/lib/contentTypes";
import { useMe, useT, useToast } from "@/components/app/AppProvider";
import { Avatar, UserChip, UserLink } from "@/components/ui/Avatar";
import { Time } from "@/components/ui/Time";
import { useConfirm } from "@/components/ui/ui";
import { RichText } from "@/components/content/RichText";
import { LinkPreviews } from "@/components/content/LinkPreviews";
import type { LinkPreview } from "@/lib/links";
import { Reactions } from "@/components/content/Reactions";
import { Comments } from "@/components/content/Comments";
import { ItemMenu } from "@/components/content/ItemMenu";
import { DateTile, EventWhen, RsvpButtons } from "@/components/feed/EventCard";
import { describeRepeat } from "@/lib/repeat";
import { clock } from "@/lib/clock";
import { GroupChip } from "@/components/feed/PostCard";
import { cancelEventAction, deleteEventAction, saveAction } from "@/app/actions/content";

function People({ title, list }: { title: string; list: EventView["going"] }) {
  if (!list.length) return null;
  return (
    <div className="stack tight">
      <span className="label">
        {title} · {list.length}
      </span>
      <div className="stack tight">
        {list.map((u) => (
          <UserChip key={u.id} user={u} size={30} presence />
        ))}
      </div>
    </div>
  );
}

export function EventDetail({ event, previews }: { event: EventView; previews?: Record<string, LinkPreview | null> }) {
  const me = useMe();
  const toast = useToast();
  const t = useT();
  const router = useRouter();
  const [e, setE] = useState(event);
  const { confirm, node } = useConfirm();
  const maps = e.location && !/^https?:\/\//.test(e.location) ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(e.location)}` : e.location.startsWith("http") ? e.location : null;
  return (
    <div className="with-side">
      <div className="stack loose" style={{ minWidth: 0 }}>
        <article className={`panel event-detail ${e.cancelled ? "cancelled" : ""}`} style={{ ["--ec" as string]: e.color }}>
          {e.cover ? <div className="event-cover" style={{ backgroundImage: `url("${e.cover}")` }} /> : <div className="event-band" />}
          <div className="panel-pad stack">
            <div className="row top" style={{ gap: 16 }}>
              <DateTile t={e.startAt} color={e.color} />
              <div className="grow" style={{ minWidth: 0 }}>
                {e.cancelled ? <span className="badge danger">{t("Cancelled")}</span> : null}
                <h1 className="display event-h1">{e.title}</h1>
                <div className="small muted" style={{ marginTop: 6 }}>
                  {t("Planned by")} <UserLink user={e.author} /> {e.group ? <>{t("for")} <GroupChip g={e.group} /></> : null}{e.private ? <> · <Lock size={12} style={{ verticalAlign: "-1px" }} /> {t("only you")}</> : null} · <Time t={e.createdAt} />
                </div>
              </div>
              <ItemMenu
                url={`/events/${e.id}`}
                onSave={async () => {
                  const r = await saveAction("event", e.id);
                  if (r.ok) toast(r.data ? t("Saved.") : t("Taken out of Saved."));
                }}
                onEdit={e.canEdit ? () => router.push(`/events/${e.id}/edit`) : undefined}
                extra={
                  e.canEdit ? (
                    <button
                      type="button"
                      className="menu-item"
                      data-close
                      onClick={async () => {
                        const r = await cancelEventAction(e.id, !e.cancelled);
                        if (r.ok && r.data) {
                          setE(r.data);
                          toast(r.data.cancelled ? t("Cancelled: everyone going has been told.") : t("It's back on."));
                        }
                      }}
                    >
                      {e.cancelled ? <RotateCcw size={16} /> : <Ban size={16} />} {e.cancelled ? t("Back on") : t("Cancel the event")}
                    </button>
                  ) : null
                }
                onDelete={
                  e.canEdit
                    ? () =>
                        confirm(t("Delete the event with its comments? (Cancelling tells people; deleting just removes it.)"), t("Delete"), async () => {
                          const r = await deleteEventAction(e.id);
                          if (r.ok) router.push("/calendar");
                          else toast(r.error, { kind: "err" });
                        })
                    : undefined
                }
                report={e.author.id !== me?.id ? { type: "event", id: e.id } : undefined}
              />
            </div>
            <div className="event-facts">
              <div className="row top">
                <Clock size={18} className="muted" />
                <div>
                  <EventWhen e={e} />
                  {e.repeat !== "none" ? (
                    <div className="small muted row" style={{ gap: 4 }}>
                      <Repeat size={13} /> {describeRepeat(t, e, clock().weekStart)}
                      {e.repeatUntil ? <> {t("until")} <Time t={e.repeatUntil} mode="date" /></> : null}
                    </div>
                  ) : null}
                </div>
              </div>
              {e.location ? (
                <div className="row top">
                  <MapPin size={18} className="muted" />
                  <div>
                    {e.location}
                    {maps ? (
                      <>
                        {" "}
                        <a href={maps} target="_blank" rel="noopener noreferrer" className="link small">
                          {t("Map")}
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div className="row top">
                <Users size={18} className="muted" />
                <div>
                  {e.capacity ? t("{n} going of {cap} places", { n: e.going.length, cap: e.capacity }) : t("{n} going", { n: e.going.length })}
                  {e.maybe.length ? ` · ${t("{n} maybe", { n: e.maybe.length })}` : ""}
                </div>
              </div>
            </div>
            <div className="row wrap" style={{ gap: 10 }}>
              <RsvpButtons e={e} onChange={setE} size="md" />
              <a href={`/events/${e.id}/ics`} className="btn" download>
                <CalendarPlus size={16} /> {t("Add to my calendar")}
              </a>
            </div>
            {e.html ? (
              <>
                <hr />
                <RichText html={e.html} />
                <LinkPreviews html={e.html} initial={previews} />
              </>
            ) : null}
            <div className="post-foot">
              <Reactions type="event" id={e.id} initial={e.reactions} myName={me?.name ?? ""} />
            </div>
          </div>
        </article>
        <section className="panel panel-pad">
          <span className="eyebrow">{t("Talk about it")}</span>
          <Comments type="event" id={e.id} />
        </section>
      </div>
      <aside className="stack side-sticky">
        <div className="panel panel-pad stack">
          <People title={t("Going")} list={e.going} />
          <People title={t("Maybe")} list={e.maybe} />
          <People title={t("Can't make it")} list={e.no} />
          {!e.going.length && !e.maybe.length && !e.no.length ? <span className="small muted">{t("No answers yet.")}</span> : null}
          {e.going.length > 1 ? (
            <Link href={`/chat?dm=${e.author.id}`} className="small link">
              {t("Message the planner")}
            </Link>
          ) : null}
        </div>
        <div className="panel panel-pad-sm row" style={{ gap: 8 }}>
          <span className="avatar-stack">
            {[...e.going, ...e.maybe].slice(0, 8).map((u) => (
              <Avatar key={u.id} user={u} size={26} />
            ))}
          </span>
        </div>
      </aside>
      {node}
    </div>
  );
}
