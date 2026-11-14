"use client";

import Link from "next/link";
import { createContext, useContext, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import type { CategoryView } from "@/lib/contentTypes";
import type { ThemePrefs } from "@/lib/types";
import { useT } from "@/components/app/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Time } from "@/components/ui/Time";
import { setPrefsAction } from "@/app/actions/me";

type View = ThemePrefs["forumView"];
const Ctx = createContext<{ view: View; setView: (v: View) => void }>({ view: "cards", setView: () => {} });

/** The forum's front, as cards or as rows (each member's own choice, kept with their preferences): around its switch and its categories. */
export function ForumView({ initial, children }: { initial: View; children: React.ReactNode }) {
  const [view, set] = useState<View>(initial);
  const setView = (v: View) => {
    if (v === view) return;
    set(v);
    void setPrefsAction({ forumView: v });
  };
  return <Ctx.Provider value={{ view, setView }}>{children}</Ctx.Provider>;
}

/** Cards or a list: the switch beside "New thread". */
export function ForumViewToggle() {
  const t = useT();
  const { view, setView } = useContext(Ctx);
  const opt = (v: View, Icon: typeof List, label: string) => (
    <button type="button" className={`pill ${view === v ? "active" : ""}`} aria-pressed={view === v} onClick={() => setView(v)}>
      <Icon size={14} aria-hidden /> {t(label)}
    </button>
  );
  return (
    <div className="pills forum-view" role="group" aria-label={t("Show the forums as")}>
      {opt("cards", LayoutGrid, "Cards")}
      {opt("list", List, "List")}
    </div>
  );
}

/** The forum's categories, as the switch says. */
export function ForumCategories({ cats }: { cats: CategoryView[] }) {
  const { view } = useContext(Ctx);
  return view === "list" ? <CategoryRows cats={cats} /> : <CategoryCards cats={cats} />;
}

function CategoryCards({ cats }: { cats: CategoryView[] }) {
  const t = useT();
  return (
    <div className="cat-grid">
      {cats.map((c) => (
        <Link key={c.id} href={`/forum/${c.slug}`} className="panel cat-card hoverable" style={{ ["--cc" as string]: c.color }}>
          <span className="cat-icon">{c.icon || c.name.slice(0, 1)}</span>
          <span className="grow" style={{ minWidth: 0 }}>
            <span className="row" style={{ gap: 8 }}>
              <b className="h3">{c.name}</b>
              {c.unread ? <span className="badge hot">{t.n(c.unread, "1 new", "{n} new")}</span> : null}
              {c.group ? <span className="badge teal">{c.group.name}</span> : null}
            </span>
            <span className="small dim clamp-2">{c.description}</span>
            <span className="tiny muted" style={{ display: "block", marginTop: 6 }}>
              {t.n(c.threads, "{n} thread", "{n} threads")} · {t.n(c.posts, "{n} post", "{n} posts")}
              {c.last ? (
                <>
                  {" "}
                  · {t("last:")} <span className="dim">{c.last.title}</span> <Time t={c.last.at} />
                </>
              ) : null}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/**
 * The categories as a forum's front usually is: a row each with its threads, its posts and its
 * latest post (that one a link to its thread), the columns lined up (subgrid). In a narrow column the
 * counts and the latest go in a line under the name.
 */
function CategoryRows({ cats }: { cats: CategoryView[] }) {
  const t = useT();
  return (
    <div className="panel cat-table">
      <div className="cat-table-head" aria-hidden>
        <span>{t("Forum")}</span>
        <span className="num">{t("Threads")}</span>
        <span className="num">{t("Posts")}</span>
        <span>{t("Latest post")}</span>
      </div>
      {cats.map((c) => (
        <div key={c.id} className={`cat-row ${c.unread ? "unread" : ""}`} style={{ ["--cc" as string]: c.color }}>
          <span className="cat-icon sm" aria-hidden>
            {c.icon || c.name.slice(0, 1)}
          </span>
          <span className="cat-row-main">
            <span className="row" style={{ gap: 8, minWidth: 0 }}>
              <Link href={`/forum/${c.slug}`} className="cat-row-name ellipsis">
                {c.name}
              </Link>
              {c.unread ? <span className="badge hot">{t.n(c.unread, "1 new", "{n} new")}</span> : null}
              {c.group ? <span className="badge teal">{c.group.name}</span> : null}
            </span>
            {c.description ? <span className="small dim cat-row-desc">{c.description}</span> : null}
            <span className="tiny muted cat-row-narrow">
              {t.n(c.threads, "{n} thread", "{n} threads")} · {t.n(c.posts, "{n} post", "{n} posts")}
              {c.last ? (
                <>
                  {" "}
                  · {t("last:")} <Time t={c.last.at} />
                </>
              ) : null}
            </span>
          </span>
          <span className="num" title={t("Threads")}>
            {c.threads}
          </span>
          <span className="num" title={t("Posts")}>
            {c.posts}
          </span>
          {c.last ? (
            <Link href={`/forum/t/${c.last.threadId}`} className="cat-last" title={t("Latest post")}>
              {c.last.by ? <Avatar user={c.last.by} size={26} /> : null}
              <span className="thread-last-text">
                <span className="small cat-last-title">{c.last.title}</span>
                <span className="tiny muted">
                  {c.last.by ? `${c.last.by.name} · ` : ""}
                  <Time t={c.last.at} />
                </span>
              </span>
            </Link>
          ) : (
            <span className="cat-last tiny muted">{t("No threads yet")}</span>
          )}
        </div>
      ))}
    </div>
  );
}
