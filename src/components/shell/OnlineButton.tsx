"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { useApp, useT } from "@/components/app/AppProvider";
import { useMembers } from "@/components/app/useMembers";
import { Avatar } from "@/components/ui/Avatar";
import { useDropdown } from "@/components/ui/ui";

/** Who's here right now (you too), by the bell: a count, and the people when opened. */
export function OnlineButton() {
  const { me, presence } = useApp();
  const t = useT();
  const { open, setOpen, toggle, ref } = useDropdown();
  if (!me) return null;
  const ids = new Set(presence.keys());
  // you're here, even when invisible to the others
  ids.add(me.id);
  const label = t.n(ids.size, "{n} person here now", "{n} people here now");
  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="icon-btn online-btn" onClick={toggle} aria-haspopup="dialog" aria-expanded={open} aria-label={label} title={label}>
        <Users size={19} />
        <span className="online-n">{ids.size}</span>
      </button>
      {open ? <OnlineList ids={[...ids]} meId={me.id} onPick={() => setOpen(false)} /> : null}
    </div>
  );
}

/** Mounted only when opened, so the members are only fetched then. */
function OnlineList({ ids, meId, onPick }: { ids: number[]; meId: number; onPick: () => void }) {
  const t = useT();
  const members = useMembers();
  const people = ids
    .map((id) => members.get(id))
    .filter((m) => !!m)
    .sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : a.name.localeCompare(b.name)));
  return (
    <div className="panel menu down right online-menu" role="dialog" aria-label={t("Here now")}>
      <div style={{ padding: "8px 12px 6px" }}>
        <span className="eyebrow">{t("Here now · {n}", { n: ids.length })}</span>
      </div>
      <div className="online-scroll">
        {members.size === 0 ? (
          <div className="stack tight" style={{ padding: 12 }}>
            <div className="skeleton" style={{ height: 36 }} />
          </div>
        ) : (
          people.map((m) => (
            <Link key={m.id} href={`/u/${encodeURIComponent(m.username)}`} className="menu-item" onClick={onPick}>
              <Avatar user={m} size={30} presence />
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="ellipsis" style={{ display: "block", fontWeight: 700 }}>
                  {m.name}
                  {m.id === meId ? <span className="muted"> ({t("you")})</span> : null}
                </span>
                {m.statusEmoji || m.statusText ? (
                  <span className="tiny muted ellipsis" style={{ display: "block" }}>
                    {m.statusEmoji} {m.statusText}
                  </span>
                ) : null}
              </span>
            </Link>
          ))
        )}
      </div>
      <Link href="/members" className="menu-item" style={{ justifyContent: "center", borderTop: "1px solid var(--line)", borderRadius: 0 }} onClick={onPick}>
        {t("All members")}
      </Link>
    </div>
  );
}
