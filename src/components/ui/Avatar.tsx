"use client";

import Link from "next/link";
import type { UserSummary } from "@/lib/types";
import { usePresence, useT } from "@/components/app/AppProvider";
import { ringCss } from "@/lib/rings";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return [...parts[0]].slice(0, 2).join("").toUpperCase();
  return ([...parts[0]][0] + [...parts[parts.length - 1]][0]).toUpperCase();
}

/**
 * A round picture (or initials on the member's colour), with an online dot if asked, and the ring
 * they chose (rings.ts). The ring is drawn inside the circle's edge, with a hair of space before the
 * picture: outside it is where the green "talking" ring goes in a voice chat, so the two never meet.
 */
export function Avatar({ user, size = 32, presence = false, className = "" }: { user: Pick<UserSummary, "id" | "name" | "avatar" | "accent"> & { ring?: string | null }; size?: number; presence?: boolean; className?: string }) {
  const ring = ringCss(user.ring);
  const style: Record<string, string | number> = { width: size, height: size, fontSize: Math.max(10, size * 0.38), "--av": user.accent };
  if (ring) {
    style["--ring"] = ring;
    style["--rw"] = `${Math.min(5, Math.max(1.5, Math.round(size * 0.13) / 2))}px`;
    style["--rg"] = `${Math.min(3, Math.max(1, Math.round(size * 0.03)))}px`;
  }
  return (
    <span className={`avatar ${ring ? "ringed" : ""} ${className}`} style={style} aria-hidden>
      {user.avatar ? <img src={user.avatar} alt="" loading="lazy" decoding="async" /> : initials(user.name)}
      {presence ? <PresenceDot id={user.id} /> : null}
    </span>
  );
}

function PresenceDot({ id }: { id: number }) {
  const t = useT();
  const s = usePresence(id);
  if (s === "offline") return null;
  return <i className={`presence ${s}`} title={s === "online" ? t("Online") : s === "away" ? t("Away") : t("Busy")} />;
}

export const ROLE_LABEL = { admin: "Admin", moderator: "Mod", member: "" } as const;

/** Avatar and name, linking to the profile. */
export function UserChip({ user, size = 28, presence = false, sub, showRole = false, noLink = false }: { user: UserSummary; size?: number; presence?: boolean; sub?: React.ReactNode; showRole?: boolean; noLink?: boolean }) {
  const t = useT();
  const inner = (
    <>
      <Avatar user={user} size={size} presence={presence} />
      <span className="stack" style={{ gap: 0, minWidth: 0 }}>
        <span className="row" style={{ gap: 6 }}>
          <span className="user-name ellipsis">{user.name}</span>
          {user.statusEmoji ? <span title={user.statusText || undefined}>{user.statusEmoji}</span> : null}
          {showRole && ROLE_LABEL[user.role] ? <span className="role-tag">{t(ROLE_LABEL[user.role])}</span> : null}
        </span>
        {sub ? <span className="tiny muted ellipsis" style={{ fontWeight: 500 }}>{sub}</span> : null}
      </span>
    </>
  );
  if (noLink || !user.id) return <span className="user-chip">{inner}</span>;
  return (
    <Link href={`/u/${encodeURIComponent(user.username)}`} className="user-chip">
      {inner}
    </Link>
  );
}

export function UserLink({ user }: { user: UserSummary }) {
  if (!user.id) return <b>{user.name}</b>;
  return (
    <Link href={`/u/${encodeURIComponent(user.username)}`} className="strong" style={{ color: "var(--text)" }}>
      {user.name}
    </Link>
  );
}
