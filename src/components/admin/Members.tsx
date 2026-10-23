"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, Check, Copy, KeyRound, LogOut, Search, Timer, Trash2, UserPlus, X } from "lucide-react";
import type { AdminMember } from "@/lib/admin";
import type { Role } from "@/lib/types";
import { useApp, useToast } from "@/components/app/AppProvider";
import { UserChip } from "@/components/ui/Avatar";
import { Time } from "@/components/ui/Time";
import { Dropdown, Modal, useConfirm } from "@/components/ui/ui";
import { addMemberAction, approveAction, banAction, deleteMemberAction, logoutEverywhereAction, resetLinkAction, setPasswordAction, setRoleAction, suspendAction } from "@/app/actions/admin";

type Filter = "all" | "waiting" | "suspended" | "closed" | "staff";

export function Members({ members, base, focus }: { members: AdminMember[]; base: string; focus?: number }) {
  const { me } = useApp();
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
    if (!r.ok) toast(r.error ?? "That didn't work.", { kind: "err" });
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
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a member" aria-label="Find a member" />
        </div>
        <div className="pills scroll">
          {(
            [
              ["all", `All · ${members.length}`],
              ["waiting", `Waiting · ${counts.waiting}`],
              ["suspended", `Suspended · ${counts.suspended}`],
              ["closed", `Closed · ${counts.closed}`],
              ["staff", "Admins & mods"],
            ] as [Filter, string][]
          ).map(([f, l]) => (
            <button key={f} type="button" className={`pill ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {l}
            </button>
          ))}
        </div>
        {isAdmin ? (
          <button type="button" className="btn btn-sm" onClick={() => setAdding(true)}>
            <UserPlus size={15} /> Add a member
          </button>
        ) : null}
      </div>
      <div className="list inset admin-members">
        {list.map((m) => {
          const suspended = !!m.suspendedUntil && m.suspendedUntil > now;
          return (
            <div key={m.id} className={`list-row ${focus === m.id ? "unread" : ""}`} id={`member-${m.id}`}>
              <UserChip user={m} size={36} presence sub={<>@{m.username} · joined <Time t={m.createdAt} mode="date" />{m.invitedBy ? ` · invited by ${m.invitedBy}` : ""}</>} />
              <span className="spacer" />
              <span className="admin-member-meta tiny muted">
                {m.lastSeen ? <>seen <Time t={m.lastSeen} /></> : "never seen"}
                <br />
                {m.posts} posts · {m.messages} messages
              </span>
              {m.pending ? <span className="badge accent">Waiting</span> : null}
              {suspended ? (
                <span className="badge danger" title={`Until ${new Date(m.suspendedUntil!).toLocaleString()}`}>
                  <Timer size={11} /> Suspended
                </span>
              ) : null}
              {m.banned ? <span className="badge danger">Closed</span> : null}
              {m.pending ? (
                <>
                  <button type="button" className="btn btn-primary btn-xs" onClick={() => run(approveAction(m.id, true), `${m.name} is in.`)}>
                    <Check size={13} /> Let in
                  </button>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => confirm(`Turn ${m.name} away? Their account is deleted.`, "Turn away", () => run(approveAction(m.id, false)))}>
                    <X size={13} /> No
                  </button>
                </>
              ) : null}
              {isAdmin && m.id !== me?.id ? (
                <select className="select admin-role" value={m.role} onChange={(e) => run(setRoleAction(m.id, e.target.value as Role), "Role changed.")} aria-label={`${m.name}'s role`}>
                  <option value="member">Member</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <span className="badge">{m.role}</span>
              )}
              {m.id !== me?.id ? (
                <Dropdown label="Manage" button={<span className="small">⋯</span>}>
                  <div className="menu-label">Suspend (can&apos;t log in)</div>
                  {[1, 7, 30].map((d) => (
                    <button key={d} type="button" className="menu-item" data-close onClick={() => run(suspendAction(m.id, d), `${m.name} is suspended for ${d} ${d === 1 ? "day" : "days"}.`)}>
                      <Timer size={16} /> {d} {d === 1 ? "day" : "days"}
                    </button>
                  ))}
                  {suspended ? (
                    <button type="button" className="menu-item" data-close onClick={() => run(suspendAction(m.id, null), "Suspension lifted.")}>
                      <Check size={16} /> Lift the suspension
                    </button>
                  ) : null}
                  <div className="menu-sep" />
                  <button type="button" className="menu-item" data-close onClick={() => run(logoutEverywhereAction(m.id), "Logged out everywhere.")}>
                    <LogOut size={16} /> Log out everywhere
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
                        <KeyRound size={16} /> Password reset link
                      </button>
                      <button type="button" className="menu-item" data-close onClick={() => setPwFor(m)}>
                        <KeyRound size={16} /> Set a password
                      </button>
                      <div className="menu-sep" />
                      {m.banned ? (
                        <button type="button" className="menu-item" data-close onClick={() => run(banAction(m.id, false, ""), "Account opened again.")}>
                          <Check size={16} /> Open the account again
                        </button>
                      ) : (
                        <button type="button" className="menu-item danger" data-close onClick={() => setBanFor(m)}>
                          <Ban size={16} /> Close the account
                        </button>
                      )}
                      <button
                        type="button"
                        className="menu-item danger"
                        data-close
                        onClick={() => confirm(`Delete ${m.name} and everything they made? This can't be undone. (Closing the account keeps their posts.)`, "Delete", () => run(deleteMemberAction(m.id), "Deleted."))}
                      >
                        <Trash2 size={16} /> Delete for good
                      </button>
                    </>
                  ) : null}
                </Dropdown>
              ) : (
                <span className="badge accent">You</span>
              )}
            </div>
          );
        })}
        {!list.length ? <div className="panel-body small muted" style={{ paddingTop: 14 }}>Nobody here.</div> : null}
      </div>

      {link ? (
        <Modal title={`A new password for ${link.name}`} onClose={() => setLink(null)}>
          <p className="small" style={{ marginTop: 0 }}>
            Send them this link (it works once, for three days). Opening it lets them choose a new password.
          </p>
          <div className="input-group">
            <input className="input sm mono" value={link.url} readOnly onFocus={(e) => e.target.select()} />
            <button type="button" className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(link.url).then(() => toast("Copied."))}>
              <Copy size={14} /> Copy
            </button>
          </div>
        </Modal>
      ) : null}
      {pwFor ? (
        <Modal
          title={`Set ${pwFor.name}'s password`}
          onClose={() => setPwFor(null)}
          footer={
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                await run(setPasswordAction(pwFor.id, pw), "Password set. They've been logged out everywhere.");
                setPw("");
                setPwFor(null);
              }}
            >
              Set it
            </button>
          }
        >
          <input className="input" type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" autoFocus />
        </Modal>
      ) : null}
      {banFor ? (
        <Modal
          title={`Close ${banFor.name}'s account?`}
          onClose={() => setBanFor(null)}
          footer={
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                await run(banAction(banFor.id, true, reason), "Account closed.");
                setReason("");
                setBanFor(null);
              }}
            >
              Close it
            </button>
          }
        >
          <p className="small" style={{ marginTop: 0 }}>
            They can&apos;t log in any more; what they wrote stays. You can open it again later.
          </p>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why (they see this when they try to log in)" maxLength={200} />
        </Modal>
      ) : null}
      {adding ? (
        <Modal
          title="Add a member"
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
                Make the account
              </button>
            )
          }
        >
          {created ? (
            <div className="stack small">
              <p style={{ margin: 0 }}>
                Done. Give them these (they can change the password under Settings → Account):
              </p>
              <div className="inset panel-pad-sm mono">
                {base}/login
                <br />
                username: {created.username}
                <br />
                password: {created.password}
              </div>
              <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => navigator.clipboard?.writeText(`${base}/login\nusername: ${created.username}\npassword: ${created.password}`).then(() => toast("Copied."))}>
                <Copy size={14} /> Copy
              </button>
            </div>
          ) : (
            <div className="stack">
              <div className="field">
                <label>Name</label>
                <input className="input" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} maxLength={40} autoFocus />
              </div>
              <div className="field">
                <label>Username</label>
                <input className="input" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} maxLength={24} autoCapitalize="none" />
              </div>
              <div className="field">
                <label>Role</label>
                <select className="select" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}>
                  <option value="member">Member</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <p className="hint" style={{ margin: 0 }}>
                A password is made up for them; you&apos;ll see it once. (An invite link is usually nicer: they choose their own.)
              </p>
            </div>
          )}
        </Modal>
      ) : null}
      {node}
    </div>
  );
}
