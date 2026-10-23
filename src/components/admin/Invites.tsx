"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Link2, Plus, Share2, X } from "lucide-react";
import { useT, useToast } from "@/components/app/AppProvider";
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
  const t = useT();
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
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) void navigator.share({ url: u, title: t("Join us") }).catch(() => {});
    else void navigator.clipboard?.writeText(u).then(() => toast(t("Link copied.")));
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
        <span className="label">{t("Who can make an account")}</span>
        <div className="pills">
          {(
            [
              ["invite", t("With an invite link")],
              ["open", t("Anyone (sign-up page)")],
              ["closed", t("Nobody new")],
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
              <b>{t("New sign-ups wait for a yes")}</b>
              <span className="small muted">{t("You (or a moderator) let them in under Members.")}</span>
            </span>
            <Switch on={approve} onChange={(v) => saveReg(reg, v)} label={t("New sign-ups wait for approval")} />
          </div>
        ) : null}
      </div>

      <div className="inset panel-pad-sm stack">
        <b>{t("New invite link")}</b>
        <div className="grid-2">
          <input className="input sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Who it's for (just a note for you)")} maxLength={80} />
          <div className="input-group">
            <select className="select" value={uses} onChange={(e) => setUses(e.target.value)} aria-label={t("How many people")}>
              <option value="1">{t("For 1 person")}</option>
              <option value="5">{t("For 5 people")}</option>
              <option value="20">{t("For 20 people")}</option>
              <option value="">{t("Any number")}</option>
            </select>
            <select className="select" value={days} onChange={(e) => setDays(e.target.value)} aria-label={t("Works for")}>
              <option value="1">{t("for 1 day")}</option>
              <option value="7">{t("for a week")}</option>
              <option value="30">{t("for a month")}</option>
              <option value="">{t("forever")}</option>
            </select>
          </div>
          <select className="select" value={role} onChange={(e) => setRole(e.target.value as "member" | "moderator")} aria-label={t("Role")}>
            <option value="member">{t("They join as members")}</option>
            <option value="moderator">{t("They join as moderators")}</option>
          </select>
          <select className="select" value={group} onChange={(e) => setGroup(e.target.value)} aria-label={t("Group")}>
            <option value="">{t("…and join no group")}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {t("…and join {name}", { name: g.name })}
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
          <Plus size={15} /> {t("Make the link")}
        </button>
        {made ? (
          <div className="input-group">
            <input className="input sm mono" value={url(made)} readOnly onFocus={(e) => e.target.select()} />
            <button type="button" className="btn btn-sm" onClick={() => share(made)}>
              <Share2 size={14} /> {t("Share")}
            </button>
          </div>
        ) : null}
      </div>

      <div className="list inset">
        {live.map((i) => (
          <div key={i.code} className="list-row">
            <Link2 size={18} className="muted" />
            <span className="grow" style={{ minWidth: 0 }}>
              <b>{i.note || t("Invite")}</b>{" "}
              <span className="tiny muted">
                {t("{uses}/{max} used", { uses: i.uses, max: i.maxUses ?? "∞" })} · {i.expiresAt ? <>{t("until")} <Time t={i.expiresAt} mode="date" /></> : t("no end")}
                {i.role !== "member" ? ` · ${t("as {role}", { role: t(i.role) })}` : ""}
                {i.group ? ` · ${t("joins {group}", { group: i.group })}` : ""} · {t("by {name}", { name: i.by ?? "—" })}
              </span>
              {i.joined.length ? <span className="tiny dim" style={{ display: "block" }}>{t("Joined: {names}", { names: i.joined.join(", ") })}</span> : null}
            </span>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => share(i.code)}>
              <Copy size={13} /> {t("Link")}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={async () => {
                await revokeInviteAction(i.code);
                router.refresh();
              }}
            >
              <X size={13} /> {t("Stop it")}
            </button>
          </div>
        ))}
        {!live.length ? <div className="panel-body small muted" style={{ paddingTop: 12 }}>{t("No working invite links.")}</div> : null}
      </div>
      {old.length ? (
        <details className="small">
          <summary className="muted" style={{ cursor: "pointer" }}>
            {t("Used up, expired or stopped · {n}", { n: old.length })}
          </summary>
          <div className="list inset" style={{ marginTop: 8 }}>
            {old.map((i) => (
              <div key={i.code} className="list-row tiny muted">
                <span className="grow">
                  {i.note || t("Invite")} · {t("{n} used", { n: i.uses })} {i.joined.length ? `(${i.joined.join(", ")})` : ""} · {t("made")} <Time t={i.createdAt} mode="date" />
                </span>
                <span>{i.revoked ? t("stopped") : i.maxUses != null && i.uses >= i.maxUses ? t("used up") : t("expired")}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
