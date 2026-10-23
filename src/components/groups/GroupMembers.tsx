"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, Crown, Shield, UserMinus, X } from "lucide-react";
import type { UserSummary } from "@/lib/types";
import { useMe, useT, useToast } from "@/components/app/AppProvider";
import { UserChip } from "@/components/ui/Avatar";
import { Dropdown, useConfirm } from "@/components/ui/ui";
import { Time } from "@/components/ui/Time";
import { answerRequestAction, removeFromGroupAction, setGroupRoleAction } from "@/app/actions/groups";

type Role = "owner" | "admin" | "member";

export function GroupMembers({ groupId, members, requests, canManage, isOwner }: { groupId: number; members: { user: UserSummary; role: Role; joinedAt: number }[]; requests: { user: UserSummary; kind: "request" | "invite"; at: number }[]; canManage: boolean; isOwner: boolean }) {
  const me = useMe();
  const toast = useToast();
  const t = useT();
  const router = useRouter();
  const [, start] = useTransition();
  const { confirm, node } = useConfirm();
  const run = (p: Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await p;
      if (!r.ok) toast(r.error ?? t("That didn't work."), { kind: "err" });
      router.refresh();
    });
  const asking = requests.filter((r) => r.kind === "request");
  const invited = requests.filter((r) => r.kind === "invite");
  return (
    <div className="narrow-col stack loose">
      {canManage && asking.length ? (
        <section className="panel">
          <div className="panel-head">
            <span className="eyebrow">
              {t("Want to join")} · {asking.length}
            </span>
          </div>
          <div className="list">
            {asking.map((r) => (
              <div key={r.user.id} className="list-row">
                <UserChip
                  user={r.user}
                  size={34}
                  sub={
                    <>
                      {t("asked")} <Time t={r.at} />
                    </>
                  }
                />
                <span className="spacer" />
                <button type="button" className="btn btn-primary btn-sm" onClick={() => run(answerRequestAction(groupId, r.user.id, true))}>
                  <Check size={15} /> {t("Let in")}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => run(answerRequestAction(groupId, r.user.id, false))}>
                  <X size={15} /> {t("No")}
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <section className="panel">
        <div className="panel-head">
          <span className="eyebrow">
            {t("Members")} · {members.length}
          </span>
        </div>
        <div className="list">
          {members.map((m) => (
            <div key={m.user.id} className="list-row">
              <UserChip
                user={m.user}
                size={36}
                presence
                sub={
                  <>
                    {t("joined")} <Time t={m.joinedAt} mode="date" />
                  </>
                }
              />
              <span className="spacer" />
              {m.role !== "member" ? (
                <span className="badge accent">
                  {m.role === "owner" ? <Crown size={11} /> : <Shield size={11} />} {m.role === "owner" ? t("Owner") : t("Admin")}
                </span>
              ) : null}
              {canManage && m.user.id !== me?.id && m.role !== "owner" ? (
                <Dropdown label={t("Manage")} button={<span className="small">⋯</span>}>
                  {m.role === "member" ? (
                    <button type="button" className="menu-item" data-close onClick={() => run(setGroupRoleAction(groupId, m.user.id, "admin"))}>
                      <Shield size={16} /> {t("Make admin")}
                    </button>
                  ) : (
                    <button type="button" className="menu-item" data-close onClick={() => run(setGroupRoleAction(groupId, m.user.id, "member"))}>
                      <Shield size={16} /> {t("Not admin any more")}
                    </button>
                  )}
                  {isOwner ? (
                    <button
                      type="button"
                      className="menu-item"
                      data-close
                      onClick={() => confirm(t("Hand the group over to {name}? You'll stay an admin.", { name: m.user.name }), t("Hand over"), () => run(setGroupRoleAction(groupId, m.user.id, "owner")))}
                    >
                      <Crown size={16} /> {t("Make owner")}
                    </button>
                  ) : null}
                  <button type="button" className="menu-item danger" data-close onClick={() => confirm(t("Remove {name} from the group?", { name: m.user.name }), t("Remove"), () => run(removeFromGroupAction(groupId, m.user.id)))}>
                    <UserMinus size={16} /> {t("Remove")}
                  </button>
                </Dropdown>
              ) : null}
            </div>
          ))}
        </div>
      </section>
      {canManage && invited.length ? (
        <section className="panel">
          <div className="panel-head">
            <span className="eyebrow">
              {t("Invited, not in yet")} · {invited.length}
            </span>
          </div>
          <div className="list">
            {invited.map((r) => (
              <div key={r.user.id} className="list-row">
                <UserChip
                  user={r.user}
                  size={30}
                  sub={
                    <>
                      {t("invited")} <Time t={r.at} />
                    </>
                  }
                />
                <span className="spacer" />
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => run(answerRequestAction(groupId, r.user.id, false))}>
                  {t("Take back")}
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {node}
    </div>
  );
}
