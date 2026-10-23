"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Link2, Plus, Share2, X } from "lucide-react";
import { useToast } from "@/components/app/AppProvider";
import { Switch } from "@/components/ui/ui";
import { Time } from "@/components/ui/Time";
import { createInviteAction, revokeInviteAction, saveSettingsAction } from "@/app/actions/admin";

export interface InviteView {
  code: string;
  note: string;
  uses: number;
  maxUses: number | null;
  expiresAt: number | null;
  role: string;
  group: string | null;
  by: string | null;
  createdAt: number;
  revoked: boolean;
  joined: string[];
}

export function Invites({ invites, base, registration, approveNew, groups }: { invites: InviteView[]; base: string; registration: "invite" | "open" | "closed"; approveNew: boolean; groups: { id: number; name: string }[] }) {
  const toast = useToast();
  const router = useRouter();
  const [reg, setReg] = useState(registration);
  const [approve, setApprove] = useState(approveNew);
  const [note, setNote] = useState("");
  const [uses, setUses] = useState("1");
  const [days, setDays] = useState("7");
  const [role, setRole] = useState<"member" | "moderator">("member");
  const [group, setGroup] = useState("");
  const [made, setMade] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const now = Date.now();
  const url = (code: string) => `${base}/invite/${code}`;
  const share = (code: string) => {
    const u = url(code);
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) void navigator.share({ url: u, title: "Join us" }).catch(() => {});
    else void navigator.clipboard?.writeText(u).then(() => toast("Link copied."));
  };
  const saveReg = async (r: typeof reg, a: boolean) => {
    setReg(r);
    setApprove(a);
    const res = await saveSettingsAction({ registration: r, approveNew: a });
    if (!res.ok) toast(res.error, { kind: "err" });
  };
  const live = invites.filter((i) => !i.revoked && (!i.expiresAt || i.expiresAt > now) && (i.maxUses == null || i.uses < i.maxUses));
  const old = invites.filter((i) => !live.includes(i));
  return (
    <div className="stack loose">
      <div className="stack tight">
        <span className="label">Who can make an account</span>
        <div className="pills">
          {(
            [
              ["invite", "With an invite link"],
              ["open", "Anyone (sign-up page)"],
              ["closed", "Nobody new"],
            ] as const
          ).map(([r, l]) => (
            <button key={r} type="button" className={`pill ${reg === r ? "active" : ""}`} onClick={() => saveReg(r, approve)}>
              {l}
            </button>
          ))}
        </div>
        {reg === "open" ? (
          <div className="setting-row">
            <span className="grow">
              <b>New sign-ups wait for a yes</b>
              <span className="small muted">You (or a moderator) let them in under Members.</span>
            </span>
            <Switch on={approve} onChange={(v) => saveReg(reg, v)} label="New sign-ups wait for approval" />
          </div>
        ) : null}
      </div>

      <div className="inset panel-pad-sm stack">
        <b>New invite link</b>
        <div className="grid-2">
          <input className="input sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Who it's for (just a note for you)" maxLength={80} />
          <div className="input-group">
            <select className="select" value={uses} onChange={(e) => setUses(e.target.value)} aria-label="How many people">
              <option value="1">For 1 person</option>
              <option value="5">For 5 people</option>
              <option value="20">For 20 people</option>
              <option value="">Any number</option>
            </select>
            <select className="select" value={days} onChange={(e) => setDays(e.target.value)} aria-label="Works for">
              <option value="1">for 1 day</option>
              <option value="7">for a week</option>
              <option value="30">for a month</option>
              <option value="">forever</option>
            </select>
          </div>
          <select className="select" value={role} onChange={(e) => setRole(e.target.value as "member" | "moderator")} aria-label="Role">
            <option value="member">They join as members</option>
            <option value="moderator">They join as moderators</option>
          </select>
          <select className="select" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Group">
            <option value="">…and join no group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                …and join {g.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className={`btn btn-primary btn-sm ${pending ? "loading" : ""}`}
          style={{ alignSelf: "flex-start" }}
          onClick={() =>
            start(async () => {
              const r = await createInviteAction({ note, maxUses: uses ? Number(uses) : null, days: days ? Number(days) : null, role, groupId: group ? Number(group) : null });
              if (r.ok) {
                setMade(r.data);
                setNote("");
                router.refresh();
              } else toast(r.error, { kind: "err" });
            })
          }
        >
          <Plus size={15} /> Make the link
        </button>
        {made ? (
          <div className="input-group">
            <input className="input sm mono" value={url(made)} readOnly onFocus={(e) => e.target.select()} />
            <button type="button" className="btn btn-sm" onClick={() => share(made)}>
              <Share2 size={14} /> Share
            </button>
          </div>
        ) : null}
      </div>

      <div className="list inset">
        {live.map((i) => (
          <div key={i.code} className="list-row">
            <Link2 size={18} className="muted" />
            <span className="grow" style={{ minWidth: 0 }}>
              <b>{i.note || "Invite"}</b>{" "}
              <span className="tiny muted">
                {i.uses}/{i.maxUses ?? "∞"} used · {i.expiresAt ? <>until <Time t={i.expiresAt} mode="date" /></> : "no end"}
                {i.role !== "member" ? ` · as ${i.role}` : ""}
                {i.group ? ` · joins ${i.group}` : ""} · by {i.by ?? "—"}
              </span>
              {i.joined.length ? <span className="tiny dim" style={{ display: "block" }}>Joined: {i.joined.join(", ")}</span> : null}
            </span>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => share(i.code)}>
              <Copy size={13} /> Link
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={async () => {
                await revokeInviteAction(i.code);
                router.refresh();
              }}
            >
              <X size={13} /> Stop it
            </button>
          </div>
        ))}
        {!live.length ? <div className="panel-body small muted" style={{ paddingTop: 12 }}>No working invite links.</div> : null}
      </div>
      {old.length ? (
        <details className="small">
          <summary className="muted" style={{ cursor: "pointer" }}>
            Used up, expired or stopped · {old.length}
          </summary>
          <div className="list inset" style={{ marginTop: 8 }}>
            {old.map((i) => (
              <div key={i.code} className="list-row tiny muted">
                <span className="grow">
                  {i.note || "Invite"} · {i.uses} used {i.joined.length ? `(${i.joined.join(", ")})` : ""} · made <Time t={i.createdAt} mode="date" />
                </span>
                <span>{i.revoked ? "stopped" : i.maxUses != null && i.uses >= i.maxUses ? "used up" : "expired"}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
