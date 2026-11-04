"use client";

import Link from "next/link";
import { ListChecks, Lock } from "lucide-react";
import type { ListCard } from "@/lib/contentTypes";
import { useT } from "@/components/app/AppProvider";
import { UserLink } from "@/components/ui/Avatar";
import { Time } from "@/components/ui/Time";
import { CardSection } from "@/components/feed/CardSection";
import { GroupChip } from "@/components/feed/PostCard";
import { typeIcon } from "./columnTypes";

/** A list in Lists and the feed: what it's for, its columns, and how far it's been filled in. */
export function ListCardView({ list: l, section = false }: { list: ListCard; section?: boolean }) {
  const t = useT();
  const share = l.rows ? Math.round((l.filled / l.rows) * 100) : 0;
  return (
    <article className="panel list-card">
      {section ? <CardSection kind="list" /> : null}
      <header className="post-head">
        <span className="kind-icon list">
          <ListChecks size={20} />
        </span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row wrap" style={{ gap: "2px 8px" }}>
            <span className="small muted">{t("List by")}</span> <UserLink user={l.author} />
            {l.group ? <GroupChip g={l.group} /> : null}
            {l.private ? (
              <span className="badge" title={t("Only you see it")}>
                <Lock size={11} /> {t("Only you")}
              </span>
            ) : null}
          </div>
          <div className="tiny muted">
            <Time t={l.createdAt} />
          </div>
        </div>
      </header>
      <Link href={`/lists/${l.id}`} className="list-card-title">
        {l.title}
      </Link>
      {l.text ? <p className="list-card-text small muted">{l.text}</p> : null}
      <div className="list-card-cols">
        {l.columns.slice(0, 6).map((c) => {
          const Icon = typeIcon(c.type);
          return (
            <span key={c.id} className="list-col-chip">
              <Icon size={12} /> {c.name}
            </span>
          );
        })}
        {l.columns.length > 6 ? <span className="list-col-chip">+{l.columns.length - 6}</span> : null}
      </div>
      <div className="list-card-foot">
        <span className="list-progress" aria-hidden>
          <span style={{ width: `${share}%` }} />
        </span>
        <span className="small muted">{t("{n} of {total} rows filled in", { n: l.filled, total: l.rows })}</span>
        <span className="grow" />
        {l.mine ? <span className="badge accent">{t("You're on it")}</span> : null}
        <Link href={`/lists/${l.id}`} className="btn btn-sm">
          {l.canFill && !l.mine ? t("Fill in") : t("Open the list")}
        </Link>
      </div>
    </article>
  );
}
