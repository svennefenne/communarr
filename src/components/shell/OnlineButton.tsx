"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { useApp, useT } from "@/components/app/AppProvider";
import { useMembers } from "@/components/app/useMembers";
import { Avatar } from "@/components/ui/Avatar";
import { useDropdown } from "@/components/ui/ui";

/** Who's here right now: everyone connected, and you (even when invisible to the others). */
export function useHereNow(): number[] {
  const { me, presence } = useApp();
  const ids = new Set(presence.keys());
  if (me) ids.add(me.id);
  return [...ids];
}

/** Who's here, by the bell: a count, and the people when opened. (On a phone it's in the menu, ☰.) */
export function OnlineButton() {
  const { me } = useApp();
  const t = useT();
  const ids = useHereNow();
  const { open, setOpen, toggle, ref } = useDropdown();
  if (!me) return null;
  const label = t.n(ids.length, "{n} person here now", "{n} people here now");
  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="icon-btn online-btn" onClick={toggle} aria-haspopup="dialog" aria-expanded={open} aria-label={label} title={label}>
        <Users size={19} />
        <span className="online-n">{ids.length}</span>
      </button>
      {open ? (
        <div className="panel menu down right online-menu" role="dialog" aria-label={t("Here now")}>
          <div style={{ padding: "8px 12px 6px" }}>
            <span className="eyebrow">{t("Here now · {n}", { n: ids.length })}</span>
          </div>
          <div className="online-scroll">
            <OnlinePeople ids={ids} onPick={() => setOpen(false)} />
          </div>
          <Link href="/members" className="menu-item" style={{ justifyContent: "center", borderTop: "1px solid var(--line)", borderRadius: 0 }} onClick={() => setOpen(false)}>
            {t("All members")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/** The people here now, you first. Mounted only when shown, so the members are only fetched then. */
export function OnlinePeople({ ids, onPick }: { ids: number[]; onPick: () => void }) {
  const t = useT();
  const { me } = useApp();
  const members = useMembers();
  if (members.size === 0)
    return (
      <div className="stack tight" style={{ padding: 12 }}>
        <div className="skeleton" style={{ height: 36 }} />
      </div>
    );
  const people = ids
    .map((id) => members.get(id))
    .filter((m) => !!m)
    .sort((a, b) => (a.id === me?.id ? -1 : b.id === me?.id ? 1 : a.name.localeCompare(b.name)));
  return (
    <>
      {people.map((m) => (
        <Link key={m.id} href={`/u/${encodeURIComponent(m.username)}`} className="menu-item" onClick={onPick}>
          <Avatar user={m} size={30} presence />
          <span className="grow" style={{ minWidth: 0 }}>
            <span className="ellipsis" style={{ display: "block", fontWeight: 700 }}>
              {m.name}
              {m.id === me?.id ? <span className="muted"> ({t("you")})</span> : null}
            </span>
            {m.statusEmoji || m.statusText ? (
              <span className="tiny muted ellipsis" style={{ display: "block" }}>
                {m.statusEmoji} {m.statusText}
              </span>
            ) : null}
          </span>
        </Link>
      ))}
    </>
  );
}
