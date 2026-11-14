"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarDays, Info, ListChecks, ListFilter, MessageCircle, MessagesSquare, Newspaper, Users, UsersRound, Vote } from "lucide-react";
import type { SiteSettings } from "@/lib/settings";
import { FEED_FEATURE, FEED_KINDS, homeLayout, type FeedKind, type GroupPart, type HomePanel, type HomePanelSlot, type PageSlot, type ProfilePart } from "@/lib/homePanels";
import { useT, useToast } from "@/components/app/AppProvider";
import { Switch } from "@/components/ui/ui";
import { saveSettingsAction } from "@/app/actions/admin";
import { SaveBar } from "./Section";
import { ArrangeBoard, type ArrangePart, type ArrangePlace } from "./ArrangeBoard";

const FILTERS: ArrangePart = { label: "The feed's filters", icon: ListFilter };

const PANELS: Record<HomePanel, ArrangePart> = {
  filters: FILTERS,
  calendar: { label: "Calendar", icon: CalendarDays, feature: "calendar" },
  online: { label: "Here now", icon: Users },
  chat: { label: "Chat", icon: MessageCircle, feature: "chat" },
  forum: { label: "Forum", icon: MessagesSquare, feature: "forum" },
  polls: { label: "Polls", icon: Vote, feature: "polls" },
  lists: { label: "Lists", icon: ListChecks, feature: "lists" },
  groups: { label: "Groups", icon: UsersRound, feature: "groups" },
  news: { label: "News", icon: Newspaper, feature: "news" },
};
const GROUP_PARTS: Record<GroupPart, ArrangePart> = {
  filters: FILTERS,
  upcoming: { label: "Coming up", icon: CalendarDays, feature: "calendar" },
  members: { label: "Members", icon: Users },
};
const PROFILE_PARTS: Record<ProfilePart, ArrangePart> = {
  filters: FILTERS,
  about: { label: "About", icon: Info },
  groups: { label: "Groups", icon: UsersRound, feature: "groups" },
};

const ABOVE: ArrangePlace = { id: "middle", label: "Middle", moveLabel: "Move {name} above the feed", moveTitle: "Above the feed", feed: true };
const HOME_PLACES: ArrangePlace[] = [
  { id: "left", label: "Left", moveLabel: "Move {name} to the left", moveTitle: "To the left" },
  { ...ABOVE, narrow: true },
  { id: "right", label: "Right", moveLabel: "Move {name} to the right", moveTitle: "To the right" },
];
const PAGE_PLACES: ArrangePlace[] = [ABOVE, { id: "side", label: "Side column", moveLabel: "Move {name} to the side column", moveTitle: "To the side column" }];
/** only the feed's filters go in the middle, above the feed */
const allowed = (id: string, place: string) => place !== "middle" || id === "filters";

const KIND_LABEL: Record<FeedKind, string> = { posts: "Posts", news: "News", forum: "Forum", polls: "Polls", events: "Events", lists: "Lists" };

/**
 * Admin → Front page: the parts in the front page's side columns (the feed is in the middle, always;
 * its filters go above it, or in a side column), how the calendar shows, what the feed shows. And the
 * side column of a group's page and of a profile, arranged the same way.
 */
export function HomeLayoutSettings({ s }: { s: SiteSettings }) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [panels, setPanels] = useState(() => homeLayout(s.home).panels);
  const [calendar, setCalendar] = useState(() => homeLayout(s.home).calendar);
  const [kinds, setKinds] = useState(() => homeLayout(s.home).feed);
  const [hero, setHero] = useState(() => homeLayout(s.home).hero);
  const [group, setGroup] = useState(() => homeLayout(s.home).group);
  const [profile, setProfile] = useState(() => homeLayout(s.home).profile);

  return (
    <div className="stack loose">
      <p className="small muted" style={{ margin: 0 }}>
        {t("What's beside the feed on the front page, for everyone. Drag the parts by the handle, from one side to the other too, or use the arrows; the switch takes a part off the page. The feed's filters can go above the feed too. On a screen narrower than 1280 px the left side's parts come last on the right (the filters first), and phones show neither (the filters are above the feed there).")}
      </p>
      <ArrangeBoard places={HOME_PLACES} parts={PANELS} slots={panels} onChange={(x) => setPanels(x as HomePanelSlot[])} allowed={allowed} features={s.features} />
      <div className="setting-row">
        <span className="grow">
          <b>{t("The calendar shows")}</b>
          <span className="small muted">{t("The month: its days, and its events under them. Or what's coming up next.")}</span>
        </span>
        <div className="pills">
          <button type="button" className={`pill ${calendar === "month" ? "active" : ""}`} onClick={() => setCalendar("month")}>
            {t("Month")}
          </button>
          <button type="button" className={`pill ${calendar === "upcoming" ? "active" : ""}`} onClick={() => setCalendar("upcoming")}>
            {t("Coming up")}
          </button>
        </div>
      </div>
      <div className="setting-row">
        <span className="grow">
          <b>{t("The feed shows")}</b>
          <span className="small muted">{t("What's in the feed in the middle, and in its filters. One at least.")}</span>
        </span>
        <div className="pills" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
          {FEED_KINDS.map((k) => {
            const on = kinds.includes(k);
            const feature = FEED_FEATURE[k];
            const off = feature && !s.features[feature];
            return (
              <button
                key={k}
                type="button"
                className={`pill ${on ? "active" : ""}`}
                aria-pressed={on}
                disabled={!!off || (on && kinds.length === 1)}
                title={off ? t("Off under Features & permissions") : undefined}
                onClick={() => setKinds((x) => FEED_KINDS.filter((y) => (y === k ? !on : x.includes(y))))}
              >
                {t(KIND_LABEL[k])}
              </button>
            );
          })}
        </div>
      </div>
      <div className="setting-row">
        <span className="grow">
          <b>{t("News banner")}</b>
          <span className="small muted">{t("Pinned news, or news from the last week, in a banner above the feed.")}</span>
        </span>
        <Switch on={hero} onChange={setHero} label={t("News banner")} />
      </div>
      <div className="stack">
        <b>{t("A group's page")}</b>
        <span className="small muted">{t("The side column beside a group's tabs, and where its feed's filters are. Phones have no side column: the filters are above the feed there.")}</span>
        <ArrangeBoard places={PAGE_PLACES} parts={GROUP_PARTS} slots={group} onChange={(x) => setGroup(x as PageSlot<GroupPart>[])} allowed={allowed} features={s.features} />
      </div>
      <div className="stack">
        <b>{t("A profile")}</b>
        <span className="small muted">{t("The side column beside what a member has been up to, and where its filters are.")}</span>
        <ArrangeBoard places={PAGE_PLACES} parts={PROFILE_PARTS} slots={profile} onChange={(x) => setProfile(x as PageSlot<ProfilePart>[])} allowed={allowed} features={s.features} />
      </div>
      <SaveBar
        pending={pending}
        onSave={() =>
          start(async () => {
            const r = await saveSettingsAction({ home: { panels, calendar, feed: kinds, hero, group, profile } });
            if (!r.ok) toast(r.error, { kind: "err" });
            else {
              toast(t("Saved. The front page looks like this now, for everyone."));
              router.refresh();
            }
          })
        }
      />
    </div>
  );
}
