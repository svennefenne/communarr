"use client";

import Link from "next/link";
import { useState } from "react";
import { Search } from "lucide-react";
import type { UserSummary } from "@/lib/types";
import { useApp, useT } from "@/components/app/AppProvider";
import { Avatar, ROLE_LABEL } from "@/components/ui/Avatar";

/** Everyone: who's here first, then the rest by name. */
export function MemberGrid({ members }: { members: (UserSummary & { pronouns: string })[] }) {
  const { presence } = useApp();
  const t = useT();
  const [q, setQ] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const rank = (id: number) => ({ online: 0, busy: 1, away: 2 })[presence.get(id) as "online"] ?? 3;
  const list = members
    .filter((m) => (!q || m.name.toLowerCase().includes(q.toLowerCase()) || m.username.toLowerCase().includes(q.toLowerCase())) && (!onlineOnly || presence.has(m.id)))
    .sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
  return (
    <div className="stack">
      <div className="row wrap">
        <div className="chat-search" style={{ margin: 0, flex: "1 1 220px", maxWidth: 360 }}>
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Find someone")} aria-label={t("Find someone")} />
        </div>
        <div className="pills">
          <button type="button" className={`pill ${!onlineOnly ? "active" : ""}`} onClick={() => setOnlineOnly(false)}>
            {t("Everyone")} · {members.length}
          </button>
          <button type="button" className={`pill ${onlineOnly ? "active" : ""}`} onClick={() => setOnlineOnly(true)}>
            {t("Here now")} · {members.filter((m) => presence.has(m.id)).length}
          </button>
        </div>
      </div>
      <div className="member-grid">
        {list.map((m) => (
          <Link key={m.id} href={`/u/${encodeURIComponent(m.username)}`} className="panel member-card hoverable">
            <Avatar user={m} size={64} presence />
            <b className="ellipsis" style={{ maxWidth: "100%" }}>
              {m.name}
            </b>
            <span className="tiny muted ellipsis" style={{ maxWidth: "100%" }}>
              @{m.username}
              {m.pronouns ? ` · ${m.pronouns}` : ""}
            </span>
            {ROLE_LABEL[m.role] ? <span className="role-tag">{t(ROLE_LABEL[m.role])}</span> : null}
            {m.statusText || m.statusEmoji ? (
              <span className="small dim clamp-2" style={{ textAlign: "center" }}>
                {m.statusEmoji} {m.statusText}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
