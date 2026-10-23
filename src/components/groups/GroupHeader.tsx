"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, DoorOpen, Hourglass, MessageCircle, Settings, UserPlus } from "lucide-react";
import type { GroupInfo } from "@/lib/groups";
import { useToast } from "@/components/app/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { PeoplePicker } from "@/components/ui/PeoplePicker";
import { useConfirm } from "@/components/ui/ui";
import { PRIVACY } from "./privacy";
import { cancelRequestAction, inviteToGroupAction, joinGroupAction, leaveGroupAction } from "@/app/actions/groups";

export function GroupHeader({ g, features }: { g: GroupInfo; features: { calendar: boolean; polls: boolean; chat: boolean } }) {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [inviting, setInviting] = useState(false);
  const { confirm, node } = useConfirm();
  const P = PRIVACY[g.privacy];
  const Icon = P.icon;
  const base = `/groups/${g.slug}`;
  const tabs = [
    [base, "Posts"],
    ...(features.calendar ? [[`${base}/events`, "Events"]] : []),
    ...(features.polls ? [[`${base}/polls`, "Polls"]] : []),
    [`${base}/members`, `Members · ${g.memberCount}`],
    [`${base}/about`, "About"],
    ...(g.canManage ? [[`${base}/settings`, "Settings"]] : []),
  ] as [string, string][];
  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, done?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast(r.error ?? "That didn't work.", { kind: "err" });
      else {
        if (done) toast(done);
        router.refresh();
      }
    });
  return (
    <>
      <header className="panel group-head" style={{ ["--gc" as string]: g.color }}>
        <div className="group-banner" style={g.banner ? { backgroundImage: `url("${g.banner}")` } : undefined} />
        <div className="group-head-body">
          <span className="group-avatar big" style={{ backgroundImage: g.avatar ? `url("${g.avatar}")` : undefined }}>
            {g.avatar ? "" : g.name.slice(0, 1)}
          </span>
          <div className="grow" style={{ minWidth: 0 }}>
            <span className="eyebrow row" style={{ gap: 6 }}>
              <Icon size={13} /> {P.label} group
            </span>
            <h1 className="display page-title" style={{ fontSize: "clamp(1.7rem, 4.5vw, 2.8rem)" }}>
              {g.name}
            </h1>
            {g.tagline ? <p className="dim" style={{ margin: "6px 0 0" }}>{g.tagline}</p> : null}
            <div className="row" style={{ marginTop: 10, gap: 8 }}>
              <span className="avatar-stack">
                {g.members.slice(0, 6).map((m) => (
                  <Avatar key={m.id} user={m} size={26} />
                ))}
              </span>
              <span className="small muted">
                {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
              </span>
            </div>
          </div>
          <div className="group-actions">
            {g.myRole ? (
              <>
                {features.chat && g.roomId ? (
                  <Link href={`/chat/${g.roomId}`} className="btn btn-secondary btn-sm">
                    <MessageCircle size={15} /> Chat
                  </Link>
                ) : null}
                {g.privacy === "open" || g.canManage ? (
                  <button type="button" className="btn btn-sm" onClick={() => setInviting(true)}>
                    <UserPlus size={15} /> Invite
                  </button>
                ) : null}
                {g.myRole !== "owner" ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => confirm(`Leave ${g.name}?`, "Leave", () => run(() => leaveGroupAction(g.id), "You left the group."))}>
                    <DoorOpen size={15} /> Leave
                  </button>
                ) : null}
                {g.canManage ? (
                  <Link href={`${base}/settings`} className="icon-btn framed sm" aria-label="Group settings">
                    <Settings size={16} />
                  </Link>
                ) : null}
              </>
            ) : g.request === "invite" ? (
              <button type="button" className={`btn btn-primary ${pending ? "loading" : ""}`} onClick={() => run(() => joinGroupAction(g.id), "Welcome in!")}>
                <Check size={16} /> Accept the invitation
              </button>
            ) : g.request === "request" ? (
              <button type="button" className="btn btn-sm" onClick={() => run(() => cancelRequestAction(g.id))} title="Take back your request">
                <Hourglass size={15} /> Asked to join
              </button>
            ) : g.privacy === "open" ? (
              <button type="button" className={`btn btn-primary ${pending ? "loading" : ""}`} onClick={() => run(() => joinGroupAction(g.id), "Welcome in!")}>
                <UserPlus size={16} /> Join
              </button>
            ) : g.privacy === "closed" ? (
              <button type="button" className={`btn btn-primary ${pending ? "loading" : ""}`} onClick={() => run(() => joinGroupAction(g.id), "Asked: the group's admins will answer.")}>
                <UserPlus size={16} /> Ask to join
              </button>
            ) : null}
          </div>
        </div>
      </header>
      {g.canRead ? (
        <nav className="tabs" style={{ marginTop: 16 }}>
          {tabs.map(([href, label]) => (
            <Link key={href} href={href} className={pathname === href ? "active" : ""}>
              {label}
            </Link>
          ))}
        </nav>
      ) : null}
      {inviting ? (
        <PeoplePicker
          title={`Invite to ${g.name}`}
          exclude={g.members.map((m) => m.id)}
          onClose={() => setInviting(false)}
          onDone={async (ids) => {
            const r = await inviteToGroupAction(g.id, ids);
            if (r.ok) {
              toast(r.data ? `Invited ${r.data}.` : "They're in.");
              setInviting(false);
              router.refresh();
            } else toast(r.error, { kind: "err" });
          }}
        />
      ) : null}
      {node}
    </>
  );
}
