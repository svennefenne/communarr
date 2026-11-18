"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Dices, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import type { ShelfAccount } from "@/lib/types";
import { useApp, useT, useToast } from "@/components/app/AppProvider";
import { Time } from "@/components/ui/Time";
import { refreshShelfAction, setShelfNameAction, shelfStatusAction } from "@/app/actions/settings";

/**
 * Settings → Profile: the game shelf on their profile, from their name on BoardGameGeek. While BGG is
 * putting their collection together it says so, and looks again every few seconds.
 */
export function ShelfSettings({ account: first, username }: { account: ShelfAccount | null; username: string }) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const { site } = useApp();
  const [account, setAccount] = useState(first);
  const [name, setName] = useState(first?.username ?? "");
  const [pending, start] = useTransition();
  const waiting = account?.status === "pending";

  // (pending: the site asks BGG again on its own; this only looks how it's going, for up to ten minutes)
  useEffect(() => {
    if (!waiting) return;
    const until = Date.now() + 10 * 60_000;
    const id = setInterval(async () => {
      if (Date.now() > until) return clearInterval(id);
      const r = await shelfStatusAction();
      if (r.ok && r.data?.status !== "pending") {
        setAccount(r.data);
        if (r.data?.status === "ok") toast(t.n(r.data.games, "{n} game is on your shelf.", "{n} games are on your shelf."));
        router.refresh();
      }
    }, 8_000);
    return () => clearInterval(id);
  }, [waiting, router, t, toast]);

  if (site.bgg !== "full") return null;

  const done = (r: { ok: true; data: ShelfAccount | null } | { ok: false; error: string }, said?: string) => {
    if (!r.ok) return toast(r.error, { kind: "err" });
    setAccount(r.data);
    setName(r.data?.username ?? "");
    if (r.data?.status === "ok") toast(said ?? t.n(r.data.games, "{n} game is on your shelf.", "{n} games are on your shelf."));
    router.refresh();
  };
  const link = () => start(async () => done(await setShelfNameAction(name)));
  const fetchNow = () => start(async () => done(await refreshShelfAction()));
  const remove = () => start(async () => done(await setShelfNameAction(""), t("Your game shelf is gone from your profile.")));
  const changed = name.trim() !== (account?.username ?? "");

  return (
    <section className="panel panel-pad stack">
      <div className="row" style={{ gap: 10 }}>
        <Dices size={20} className="muted" aria-hidden />
        <h2 className="h3" style={{ margin: 0 }}>
          {t("Game shelf")}
        </h2>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {t("The board games you own on BoardGameGeek, on your profile for everyone here to see. Give your name there: the site fetches the games in your collection marked as owned (no expansions) and keeps them up to date once a day.")}
      </p>
      <form
        className="row wrap"
        style={{ gap: 8 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (changed && name.trim()) link();
        }}
      >
        <input
          className="input grow"
          style={{ minWidth: 200, maxWidth: 360 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          placeholder={t("Your name on BoardGameGeek")}
          aria-label={t("Your name on BoardGameGeek")}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className={`btn btn-primary ${pending && changed ? "loading" : ""}`} disabled={pending || !changed || !name.trim()}>
          {account ? t("Change") : t("Show my games")}
        </button>
      </form>
      {account ? (
        <div className="row wrap small" style={{ gap: "6px 14px" }}>
          {account.status === "pending" ? (
            <span className="row muted" style={{ gap: 6 }}>
              <LoaderCircle size={14} className="spin" aria-hidden /> {t("Fetching your games from BoardGameGeek. They turn up on your profile in a minute or two.")}
            </span>
          ) : account.status === "unknown" ? (
            <span className="err-text">{t("There's no one called {name} on BoardGameGeek.", { name: account.username })}</span>
          ) : account.status === "error" ? (
            <span className="err-text">{t("BoardGameGeek didn't hand over your games just now. The site tries again later.")}</span>
          ) : (
            <span className="muted">
              {t.n(account.games, "{n} game", "{n} games")}
              {account.fetchedAt ? (
                <>
                  {" · "}
                  {t("fetched")} <Time t={account.fetchedAt} />
                </>
              ) : null}
            </span>
          )}
          {account.status === "ok" && account.games ? (
            <Link href={`/u/${encodeURIComponent(username)}?tab=games`} className="link">
              {t("See your shelf")}
            </Link>
          ) : null}
          <span className="row" style={{ gap: 6, marginLeft: "auto" }}>
            {account.status !== "unknown" ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={fetchNow} disabled={pending || waiting}>
                <RefreshCw size={14} /> {t("Fetch now")}
              </button>
            ) : null}
            <button type="button" className="btn btn-ghost btn-sm" onClick={remove} disabled={pending}>
              <Trash2 size={14} /> {t("Remove")}
            </button>
          </span>
        </div>
      ) : null}
    </section>
  );
}
