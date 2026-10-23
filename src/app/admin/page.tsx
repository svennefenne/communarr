import Link from "next/link";
import { Activity, Bell, Flag, LayoutGrid, Mail, MessagesSquare, Palette, Server, SlidersHorizontal, Sparkles, Type, Users } from "lucide-react";
import { requireMod } from "@/lib/auth";
import { db } from "@/lib/db";
import { activity, adminMembers, auditLog, overview, system } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { listReports } from "@/lib/reports";
import { categories } from "@/lib/forum";
import { uploadStats } from "@/lib/uploads";
import { vapidPublicKey } from "@/lib/push";
import { baseUrl } from "@/lib/url";
import { Section } from "@/components/admin/Section";
import { AdminNav, type NavGroup } from "@/components/admin/AdminNav";
import { Overview } from "@/components/admin/Overview";
import { Members } from "@/components/admin/Members";
import { Invites, type InviteView } from "@/components/admin/Invites";
import { Reports } from "@/components/admin/Reports";
import { AnnouncementSettings, FeatureSettings, IdentitySettings, LookSettings } from "@/components/admin/LookSettings";
import { ForumCategories } from "@/components/admin/ForumCategories";
import { GroupsRooms, NotifyVoice, SystemSection, type AdminGroup, type AdminRoom } from "@/components/admin/SystemSections";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  const u = await requireMod();
  const { user: focus } = await searchParams;
  const s = getSettings();
  const base = await baseUrl();
  const o = overview();
  const reports = listReports("all");
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
    { label: "At a glance", items: [{ id: "overview", label: "Overview" }] },
    {
      label: "Community",
      items: [
        { id: "members", label: "Members", badge: o.pending },
        ...(admin ? [{ id: "invites", label: "Invites & sign-up" }] : []),
        { id: "reports", label: "Reports", badge: o.reports },
        ...(admin ? [{ id: "rooms", label: "Groups & chat rooms" }] : []),
      ],
    },
    { label: "Content", items: [{ id: "content", label: "Announcement & filter" }, { id: "forum", label: "Forum categories" }] },
    ...(admin
      ? [
          { label: "Look", items: [{ id: "identity", label: "Name & texts" }, { id: "look", label: "Colours & background" }] },
          { label: "Site", items: [{ id: "features", label: "Features & permissions" }, { id: "notifications", label: "Notifications & voice" }, { id: "system", label: "System & backup" }] },
        ]
      : []),
  ];

  return (
    <div className="page admin-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">{admin ? "You run the place" : "Moderator tools"}</span>
          <h1 className="display page-title">Admin</h1>
        </div>
        <div className="page-actions">
          <Link href="/news" className="btn btn-sm">
            <Sparkles size={15} /> Write news
          </Link>
        </div>
      </div>
      <div className="admin-layout">
        <AdminNav groups={nav} />
        <div className="stack">
          <Section id="overview" title="Overview" icon={<Activity size={18} />}>
            <Overview o={o} days={activity(30)} isAdmin={admin} />
          </Section>
          <Section id="members" title="Members" icon={<Users size={18} />} hint="Roles, suspensions, closed accounts, password resets" badge={o.pending}>
            <Members members={adminMembers()} base={base} focus={focus ? Number(focus) : undefined} />
          </Section>
          {admin ? (
            <Section id="invites" title="Invites & sign-up" icon={<Mail size={18} />} hint="Who can join, and links to send">
              <Invites invites={invites} base={base} registration={s.registration} approveNew={s.approveNew} groups={groups.map((g) => ({ id: g.id, name: g.name }))} />
            </Section>
          ) : null}
          <Section id="reports" title="Reports" icon={<Flag size={18} />} hint="Things members flagged" badge={o.reports}>
            <Reports open={open} closed={reports.filter((r) => r.status !== "open").slice(0, 50)} />
          </Section>
          {admin ? (
            <Section id="rooms" title="Groups & chat rooms" icon={<LayoutGrid size={18} />}>
              <GroupsRooms groups={groups} rooms={rooms} />
            </Section>
          ) : null}
          <Section id="content" title="Announcement & word filter" icon={<Type size={18} />}>
            {admin ? <AnnouncementSettings s={s} /> : <p className="small muted">Admins set the announcement and word filter.</p>}
          </Section>
          <Section id="forum" title="Forum categories" icon={<MessagesSquare size={18} />}>
            <ForumCategories cats={categories(u)} groups={groups.map((g) => ({ id: g.id, name: g.name }))} />
          </Section>
          {admin ? (
            <>
              <Section id="identity" title="Name & texts" icon={<Type size={18} />}>
                <IdentitySettings s={s} />
              </Section>
              <Section id="look" title="Colours & background" icon={<Palette size={18} />} hint="The default look for everyone">
                <LookSettings s={s} />
              </Section>
              <Section id="features" title="Features & permissions" icon={<SlidersHorizontal size={18} />}>
                <FeatureSettings s={s} />
              </Section>
              <Section id="notifications" title="Notifications & voice" icon={<Bell size={18} />}>
                <NotifyVoice s={s} vapid={vapidPublicKey()} devices={o.devices} timezones={tzs} />
              </Section>
              <Section id="system" title="System & backup" icon={<Server size={18} />}>
                <SystemSection sys={system()} storage={{ db: o.dbBytes, uploads: up.bytes, byKind: up.byKind }} audit={auditLog(120)} />
              </Section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
