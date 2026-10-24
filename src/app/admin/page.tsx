import Link from "next/link";
import { Activity, AtSign, Bell, Flag, Languages, LayoutGrid, Mail, MessageSquareText, MessagesSquare, Palette, Server, SlidersHorizontal, Sparkles, Type, Users, Volume2 } from "lucide-react";
import { requireMod } from "@/lib/auth";
import { db } from "@/lib/db";
import { activity, adminMembers, auditLog, overview, system } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { listReports } from "@/lib/reports";
import { categories } from "@/lib/forum";
import { uploadStats } from "@/lib/uploads";
import { vapidPublicKey } from "@/lib/push";
import { baseUrl } from "@/lib/url";
import { requestT } from "@/lib/t";
import { FoldAll, Section } from "@/components/admin/Section";
import { AdminNav, type NavGroup } from "@/components/admin/AdminNav";
import { Overview } from "@/components/admin/Overview";
import { Members } from "@/components/admin/Members";
import { Invites, type InviteView } from "@/components/admin/Invites";
import { Reports } from "@/components/admin/Reports";
import { Feedback } from "@/components/admin/Feedback";
import { listFeedback, openFeedback } from "@/lib/feedback";
import { AnnouncementSettings, FeatureSettings, IdentitySettings, LookSettings } from "@/components/admin/LookSettings";
import { TextsEditor } from "@/components/admin/TextsEditor";
import { ForumCategories } from "@/components/admin/ForumCategories";
import { DefaultRoom, GroupsRooms, NotifyVoice, SystemSection, type AdminGroup, type AdminRoom } from "@/components/admin/SystemSections";
import { MailAdmin } from "@/components/admin/MailAdmin";
import { SoundsAdmin } from "@/components/admin/SoundsAdmin";
import { withDefaults } from "@/lib/sounds";
import { getMailSettings, lastMailFailure, mailReady } from "@/lib/mail";
import { firstOpenRoom } from "@/lib/chat";
import { mailOrigin, rememberOrigin } from "@/lib/accountMail";

export async function generateMetadata() {
  return { title: (await requestT())("Admin") };
}
export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  const u = await requireMod();
  // (links in mails: the address an admin uses, unless PUBLIC_URL says)
  if (u.isAdmin) await rememberOrigin();
  const t = await requestT();
  const { user: focus } = await searchParams;
  const s = getSettings();
  const base = await baseUrl();
  const o = overview();
  const reports = listReports(t, "all");
  const open = reports.filter((r) => r.status === "open");
  const groups = db()
    .prepare("select g.id, g.slug, g.name, g.privacy, g.created_at createdAt, u.display_name owner, (select count(*) from group_members where group_id = g.id) members from groups g left join users u on u.id = g.owner_id order by g.name collate nocase")
    .all() as AdminGroup[];
  const rooms = (
    db()
      .prepare(
        "select r.id, r.name, r.emoji, r.kind, r.visibility, r.last_message_at lastMessageAt, r.archived, (select count(*) from room_members where room_id = r.id) members, (select count(*) from messages where room_id = r.id and kind = 'text') messages from rooms r where r.kind != 'dm' order by r.last_message_at desc",
      )
      .all() as (Omit<AdminRoom, "archived"> & { archived: number })[]
  ).map((r) => ({ ...r, archived: !!r.archived }));
  const invites = (
    db()
      .prepare("select i.*, u.display_name by_name, g.name group_name from invites i left join users u on u.id = i.created_by left join groups g on g.id = i.group_id order by i.created_at desc limit 100")
      .all() as { code: string; note: string; uses: number; max_uses: number | null; expires_at: number | null; role: string; group_name: string | null; by_name: string | null; created_at: number; revoked: number }[]
  ).map(
    (i): InviteView => ({
      code: i.code,
      note: i.note,
      uses: i.uses,
      maxUses: i.max_uses,
      expiresAt: i.expires_at,
      role: i.role,
      group: i.group_name,
      by: i.by_name,
      createdAt: i.created_at,
      revoked: !!i.revoked,
      joined: (db().prepare("select u.display_name n from invite_uses x join users u on u.id = x.user_id where x.code = ?").all(i.code) as { n: string }[]).map((r) => r.n),
    }),
  );
  const up = uploadStats();
  const tzs = (() => {
    try {
      return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
    } catch {
      return [s.timezone];
    }
  })();

  const admin = u.isAdmin;
  const nav: NavGroup[] = [
    { label: t("At a glance"), items: [{ id: "overview", label: t("Overview") }] },
    {
      label: t("Community"),
      items: [
        { id: "members", label: t("Members"), badge: o.pending },
        ...(admin ? [{ id: "invites", label: t("Invites & sign-up") }] : []),
        { id: "reports", label: t("Reports"), badge: o.reports },
        ...(admin ? [{ id: "feedback", label: t("Feedback"), badge: openFeedback() }] : []),
        ...(admin ? [{ id: "rooms", label: t("Groups & chat rooms") }] : []),
      ],
    },
    { label: t("Content"), items: [{ id: "content", label: t("Announcement & filter") }, { id: "forum", label: t("Forum categories") }] },
    ...(admin
      ? [
          { label: t("Look"), items: [{ id: "identity", label: t("Name & texts") }, { id: "texts", label: t("Texts") }, { id: "look", label: t("Colours & background") }] },
          {
            label: t("Site"),
            items: [
              { id: "features", label: t("Features & permissions") },
              { id: "notifications", label: t("Notifications & voice") },
              { id: "sounds", label: t("Sounds") },
              { id: "mail", label: t("Mail") },
              { id: "system", label: t("System & backup") },
            ],
          },
        ]
      : []),
  ];

  return (
    <div className="page admin-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">{admin ? t("You run the place") : t("Moderator tools")}</span>
          <h1 className="display page-title">{t("Admin")}</h1>
        </div>
        <div className="page-actions">
          <FoldAll />
          <Link href="/news" className="btn btn-sm">
            <Sparkles size={15} /> {t("Write news")}
          </Link>
        </div>
      </div>
      <div className="admin-layout">
        <AdminNav groups={nav} />
        <div className="stack">
          <Section id="overview" title={t("Overview")} icon={<Activity size={18} />}>
            <Overview o={o} days={activity(30)} isAdmin={admin} />
          </Section>
          <Section id="members" title={t("Members")} icon={<Users size={18} />} hint={t("Roles, suspensions, closed accounts, password resets")} badge={o.pending}>
            <Members members={adminMembers()} base={base} focus={focus ? Number(focus) : undefined} mail={mailReady()} />
          </Section>
          {admin ? (
            <Section id="invites" title={t("Invites & sign-up")} icon={<Mail size={18} />} hint={t("Who can join, and links to send")}>
              <Invites invites={invites} base={base} registration={s.registration} approveNew={s.approveNew} groups={groups.map((g) => ({ id: g.id, name: g.name }))} />
            </Section>
          ) : null}
          <Section id="reports" title={t("Reports")} icon={<Flag size={18} />} hint={t("Things members flagged")} badge={o.reports}>
            <Reports open={open} closed={reports.filter((r) => r.status !== "open").slice(0, 50)} />
          </Section>
          {admin ? (
            <Section id="feedback" title={t("Feedback")} icon={<MessageSquareText size={18} />} hint={t("What members sent from their menu")} badge={openFeedback()}>
              <Feedback items={listFeedback()} />
            </Section>
          ) : null}
          {admin ? (
            <Section id="rooms" title={t("Groups & chat rooms")} icon={<LayoutGrid size={18} />}>
              <div className="stack">
                <DefaultRoom rooms={rooms} value={s.defaultRoom === -1 ? (firstOpenRoom()?.id ?? 0) : s.defaultRoom} />
                <GroupsRooms groups={groups} rooms={rooms} />
              </div>
            </Section>
          ) : null}
          <Section id="content" title={t("Announcement & word filter")} icon={<Type size={18} />}>
            {admin ? <AnnouncementSettings s={s} /> : <p className="small muted">{t("Admins set the announcement and word filter.")}</p>}
          </Section>
          <Section id="forum" title={t("Forum categories")} icon={<MessagesSquare size={18} />}>
            <ForumCategories cats={categories(u)} groups={groups.map((g) => ({ id: g.id, name: g.name }))} />
          </Section>
          {admin ? (
            <>
              <Section id="identity" title={t("Name & texts")} icon={<Type size={18} />}>
                <IdentitySettings s={s} />
              </Section>
              <Section id="texts" title={t("Texts")} icon={<Languages size={18} />} hint={t("Any text on the site, in your own words")}>
                <TextsEditor />
              </Section>
              <Section id="look" title={t("Colours & background")} icon={<Palette size={18} />} hint={t("The default look for everyone")}>
                <LookSettings s={s} />
              </Section>
              <Section id="features" title={t("Features & permissions")} icon={<SlidersHorizontal size={18} />}>
                <FeatureSettings s={s} />
              </Section>
              <Section id="notifications" title={t("Notifications & voice")} icon={<Bell size={18} />}>
                <NotifyVoice s={s} vapid={vapidPublicKey()} devices={o.devices} timezones={tzs} />
              </Section>
              <Section id="sounds" title={t("Sounds")} icon={<Volume2 size={18} />} hint={t("Sounds for what happens on the site, and how loud")}>
                <SoundsAdmin initial={withDefaults(s.sounds)} />
              </Section>
              <Section id="mail" title={t("Mail")} icon={<AtSign size={18} />} hint={t("Forgotten passwords and notifications by mail")}>
                <MailAdmin {...mailProps(u.id, s.siteName)} />
              </Section>
              <Section id="system" title={t("System & backup")} icon={<Server size={18} />}>
                <SystemSection sys={system()} storage={{ db: o.dbBytes, uploads: up.bytes, byKind: up.byKind }} audit={auditLog(120)} />
              </Section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Admin → Mail's settings, without the password (only whether there is one). */
function mailProps(userId: number, siteName: string) {
  const { settings, source } = getMailSettings();
  const myEmail = (db().prepare("select email from users where id = ?").get(userId) as { email: string | null } | undefined)?.email ?? null;
  return {
    settings: settings ? { host: settings.host, port: settings.port, security: settings.security, user: settings.user, from: settings.from, fromName: settings.fromName, hasPass: !!settings.pass } : null,
    source,
    lastFailure: lastMailFailure(),
    myEmail,
    siteName,
    origin: mailOrigin(),
  };
}
