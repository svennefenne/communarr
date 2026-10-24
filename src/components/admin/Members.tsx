"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, Check, Copy, KeyRound, LogOut, Mail, Search, Timer, Trash2, UserPlus, X } from "lucide-react";
import type { AdminMember } from "@/lib/admin";
import type { Role } from "@/lib/types";
import { useApp, useT, useToast } from "@/components/app/AppProvider";
import { UserChip } from "@/components/ui/Avatar";
import { Time } from "@/components/ui/Time";
import { Dropdown, Modal, useConfirm } from "@/components/ui/ui";
import { addMemberAction, approveAction, banAction, deleteMemberAction, logoutEverywhereAction, mailResetLinkAction, resetLinkAction, setPasswordAction, setRoleAction, suspendAction } from "@/app/actions/admin";

type Filter = "all" | "waiting" | "suspended" | "closed" | "staff";

export function Members({ members, base, focus, mail }: { members: AdminMember[]; base: string; focus?: number; mail: boolean }) {
  const { me } = useApp();
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>(members.some((m) => m.pending) ? "waiting" : "all");
  const [link, setLink] = useState<{ name: string; url: string } | null>(null);
  const [pwFor, setPwFor] = useState<AdminMember | null>(null);
  const [pw, setPw] = useState("");
  const [adding, setAdding] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", name: "", role: "member" as Role });
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);
  const [banFor, setBanFor] = useState<AdminMember | null>(null);
  const [reason, setReason] = useState("");
  const { confirm, node } = useConfirm();
  const isAdmin = !!me?.isAdmin;
  const run = async (p: Promise<{ ok: boolean; error?: string }>, done?: string) => {
    const r = await p;
    if (!r.ok) toast(r.error ?? t("That didn't work."), { kind: "err" });
    else {
      if (done) toast(done);
      router.refresh();
    }
  };
  const now = Date.now();
  const list = members.filter((m) => {
    if (q && !m.name.toLowerCase().includes(q.toLowerCase()) && !m.username.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "waiting") return m.pending;
    if (filter === "suspended") return !!m.suspendedUntil && m.suspendedUntil > now;
    if (filter === "closed") return m.banned;
    if (filter === "staff") return m.role !== "member";
    return true;
  });
  const counts = {
    waiting: members.filter((m) => m.pending).length,
    suspended: members.filter((m) => m.suspendedUntil && m.suspendedUntil > now).length,
    closed: members.filter((m) => m.banned).length,
  };
  return (
    <div className="stack">
      <div className="row wrap">
        <div className="chat-search" style={{ margin: 0, flex: "1 1 200px", maxWidth: 320 }}>
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Find a member")} aria-label={t("Find a member")} />
        </div>
        <div className="pills scroll">
          {(
            [
              ["all", t("All · {n}", { n: members.length })],
              ["waiting", t("Waiting · {n}", { n: counts.waiting })],
              ["suspended", t("Suspended · {n}", { n: counts.suspended })],
              ["closed", t("Closed · {n}", { n: counts.closed })],
              ["staff", t("Admins & mods")],
            ] as [Filter, string][]
          ).map(([f, l]) => (
            <button key={f} type="button" className={`pill ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {l}
            </button>
          ))}
        </div>
        {isAdmin ? (
          <button type="button" className="btn btn-sm" onClick={() => setAdding(true)}>
            <UserPlus size={15} /> {t("Add a member")}
          </button>
        ) : null}
      </div>
      <div className="list inset admin-members">
        {list.map((m) => {
          const suspended = !!m.suspendedUntil && m.suspendedUntil > now;
          return (
            <div key={m.id} className={`list-row ${focus === m.id ? "unread" : ""}`} id={`member-${m.id}`}>
              <UserChip user={m} size={36} presence sub={<>@{m.username} · {t("joined")} <Time t={m.createdAt} mode="date" />{m.invitedBy ? ` · ${t("invited by {name}", { name: m.invitedBy })}` : ""}</>} />
              <span className="spacer" />
              <span className="admin-member-meta tiny muted">
                {m.lastSeen ? <>{t("seen")} <Time t={m.lastSeen} /></> : t("never seen")}
                <br />
                {t("{posts} posts · {messages} messages", { posts: m.posts, messages: m.messages })}
              </span>
              {m.pending ? <span className="badge accent">{t("Waiting")}</span> : null}
              {suspended ? (
                <span className="badge danger" title={t("Until {date}", { date: new Date(m.suspendedUntil!).toLocaleString(t.locale) })}>
                  <Timer size={11} /> {t("Suspended")}
                </span>
              ) : null}
              {m.banned ? <span className="badge danger">{t("Closed")}</span> : null}
              {m.pending ? (
                <>
                  <button type="button" className="btn btn-primary btn-xs" onClick={() => run(approveAction(m.id, true), t("{name} is in.", { name: m.name }))}>
                    <Check size={13} /> {t("Let in")}
                  </button>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => confirm(t("Turn {name} away? Their account is deleted.", { name: m.name }), t("Turn away"), () => run(approveAction(m.id, false)))}>
                    <X size={13} /> {t("No")}
                  </button>
                </>
              ) : null}
              {isAdmin && m.id !== me?.id ? (
                <select className="select admin-role" value={m.role} onChange={(e) => run(setRoleAction(m.id, e.target.value as Role), t("Role changed."))} aria-label={t("{name}'s role", { name: m.name })}>
                  <option value="member">{t("Member")}</option>
                  <option value="moderator">{t("Moderator")}</option>
                  <option value="admin">{t("Admin")}</option>
                </select>
              ) : (
                <span className="badge">{t(m.role)}</span>
              )}
              {m.id !== me?.id ? (
                <Dropdown label={t("Manage")} button={<span className="small">⋯</span>}>
                  <div className="menu-label">{t("Suspend (can't log in)")}</div>
                  {[1, 7, 30].map((d) => (
                    <button key={d} type="button" className="menu-item" data-close onClick={() => run(suspendAction(m.id, d), t.n(d, "{name} is suspended for {n} day.", "{name} is suspended for {n} days.", { name: m.name }))}>
                      <Timer size={16} /> {t.n(d, "{n} day", "{n} days")}
                    </button>
                  ))}
                  {suspended ? (
                    <button type="button" className="menu-item" data-close onClick={() => run(suspendAction(m.id, null), t("Suspension lifted."))}>
                      <Check size={16} /> {t("Lift the suspension")}
                    </button>
                  ) : null}
                  <div className="menu-sep" />
                  <button type="button" className="menu-item" data-close onClick={() => run(logoutEverywhereAction(m.id), t("Logged out everywhere."))}>
                    <LogOut size={16} /> {t("Log out everywhere")}
                  </button>
                  {isAdmin ? (
                    <>
                      <button
                        type="button"
                        className="menu-item"
                        data-close
                        onClick={async () => {
                          const r = await resetLinkAction(m.id);
                          if (r.ok) setLink({ name: m.name, url: `${base}/reset/${r.data}` });
                          else toast(r.error, { kind: "err" });
                        }}
                      >
                        <KeyRound size={16} /> {t("Password reset link")}
                      </button>
                      {mail && m.hasEmail ? (
                        <button
                          type="button"
                          className="menu-item"
                          data-close
                          onClick={async () => {
                            const r = await mailResetLinkAction(m.id);
                            if (r.ok) toast(t("A link for a new password is on its way to {name}'s confirmed address.", { name: m.name }));
                            else toast(r.error, { kind: "err" });
                          }}
                        >
                          <Mail size={16} /> {t("Mail a reset link")}
                        </button>
                      ) : null}
                      <button type="button" className="menu-item" data-close onClick={() => setPwFor(m)}>
                        <KeyRound size={16} /> {t("Set a password")}
                      </button>
                      <div className="menu-sep" />
                      {m.banned ? (
                        <button type="button" className="menu-item" data-close onClick={() => run(banAction(m.id, false, ""), t("Account opened again."))}>
                          <Check size={16} /> {t("Open the account again")}
                        </button>
                      ) : (
                        <button type="button" className="menu-item danger" data-close onClick={() => setBanFor(m)}>
                          <Ban size={16} /> {t("Close the account")}
                        </button>
                      )}
                      <button
                        type="button"
                        className="menu-item danger"
                        data-close
                        onClick={() => confirm(t("Delete {name} and everything they made? This can't be undone. (Closing the account keeps their posts.)", { name: m.name }), t("Delete"), () => run(deleteMemberAction(m.id), t("Deleted.")))}
                      >
                        <Trash2 size={16} /> {t("Delete for good")}
                      </button>
                    </>
                  ) : null}
                </Dropdown>
              ) : (
                <span className="badge accent">{t("You")}</span>
              )}
            </div>
          );
        })}
        {!list.length ? <div className="panel-body small muted" style={{ paddingTop: 14 }}>{t("Nobody here.")}</div> : null}
      </div>

      {link ? (
        <Modal title={t("A new password for {name}", { name: link.name })} onClose={() => setLink(null)}>
          <p className="small" style={{ marginTop: 0 }}>
            {t("Send them this link (it works once, for three days). Opening it lets them choose a new password.")}
          </p>
          <div className="input-group">
            <input className="input sm mono" value={link.url} readOnly onFocus={(e) => e.target.select()} />
            <button type="button" className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(link.url).then(() => toast(t("Copied.")))}>
              <Copy size={14} /> {t("Copy")}
            </button>
          </div>
        </Modal>
      ) : null}
      {pwFor ? (
        <Modal
          title={t("Set {name}'s password", { name: pwFor.name })}
          onClose={() => setPwFor(null)}
          footer={
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                await run(setPasswordAction(pwFor.id, pw), t("Password set. They've been logged out everywhere."));
                setPw("");
                setPwFor(null);
              }}
            >
              {t("Set it")}
            </button>
          }
        >
          <input className="input" type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t("At least 8 characters")} autoFocus />
        </Modal>
      ) : null}
      {banFor ? (
        <Modal
          title={t("Close {name}'s account?", { name: banFor.name })}
          onClose={() => setBanFor(null)}
          footer={
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                await run(banAction(banFor.id, true, reason), t("Account closed."));
                setReason("");
                setBanFor(null);
              }}
            >
              {t("Close it")}
            </button>
          }
        >
          <p className="small" style={{ marginTop: 0 }}>
            {t("They can't log in any more; what they wrote stays. You can open it again later.")}
          </p>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("Why (they see this when they try to log in)")} maxLength={200} />
        </Modal>
      ) : null}
      {adding ? (
        <Modal
          title={t("Add a member")}
          onClose={() => {
            setAdding(false);
            setCreated(null);
          }}
          footer={
            created ? null : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  const r = await addMemberAction(newUser.username, newUser.name, newUser.role);
                  if (r.ok) {
                    setCreated({ username: newUser.username, password: r.data });
                    router.refresh();
                  } else toast(r.error, { kind: "err" });
                }}
              >
                {t("Make the account")}
              </button>
            )
          }
        >
          {created ? (
            <div className="stack small">
              <p style={{ margin: 0 }}>
                {t("Done. Give them these (they can change the password under Settings → Account):")}
              </p>
              <div className="inset panel-pad-sm mono">
                {base}/login
                <br />
                {t("username: {username}", { username: created.username })}
                <br />
                {t("password: {password}", { password: created.password })}
              </div>
              <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => navigator.clipboard?.writeText(`${base}/login\n${t("username: {username}", { username: created.username })}\n${t("password: {password}", { password: created.password })}`).then(() => toast(t("Copied.")))}>
                <Copy size={14} /> {t("Copy")}
              </button>
            </div>
          ) : (
            <div className="stack">
              <div className="field">
                <label>{t("Name")}</label>
                <input className="input" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} maxLength={40} autoFocus />
              </div>
              <div className="field">
                <label>{t("Username")}</label>
                <input className="input" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} maxLength={24} autoCapitalize="none" />
              </div>
              <div className="field">
                <label>{t("Role")}</label>
                <select className="select" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}>
                  <option value="member">{t("Member")}</option>
                  <option value="moderator">{t("Moderator")}</option>
                  <option value="admin">{t("Admin")}</option>
                </select>
              </div>
              <p className="hint" style={{ margin: 0 }}>
                {t("A password is made up for them; you'll see it once. (An invite link is usually nicer: they choose their own.)")}
              </p>
            </div>
          )}
        </Modal>
      ) : null}
      {node}
    </div>
  );
}
