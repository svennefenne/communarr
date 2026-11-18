"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Clock, ExternalLink, Heart, Scale, Star, Trophy, Users } from "lucide-react";
import type { BggGame, GameTalk, ShelfGame } from "@/lib/types";
import { useApp, useT, useToast } from "@/components/app/AppProvider";
import { Modal } from "@/components/ui/ui";
import { Avatar } from "@/components/ui/Avatar";
import { loadGame } from "@/components/content/bggCards";
import { gameTalkAction, rateGameAction, wantGameAction } from "@/app/actions/games";

/**
 * A game's box opened on a game shelf: its facts (from BGG), your own rating (1–10) and whether you
 * want to play it, what the others make of it, and who has it. In a group, "the others" are its
 * members; elsewhere, everyone (lib/gameMarks.ts).
 */

const span = (r: [number, number]) => (r[0] === r[1] ? String(r[0]) : `${r[0]}–${r[1]}`);
const first = (name: string) => name.split(" ")[0];

export function GameDialog({ game, groupId, onClose }: { game: ShelfGame; groupId?: number; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const { me } = useApp();
  const [talk, setTalk] = useState<GameTalk | null>(null);
  const [card, setCard] = useState<BggGame | null>(null);
  const [busy, setBusy] = useState(false);
  const one = (n: number) => n.toLocaleString(t.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const load = async () => {
    const r = await gameTalkAction(game.id, groupId);
    if (r.ok) setTalk(r.data);
    else toast(r.error, { kind: "err" });
  };
  useEffect(() => {
    void load();
    // (the bigger picture, its weight and age, from the site's BGG cards)
    let live = true;
    void loadGame(game.id).then((g) => {
      if (live) setCard(g);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id, groupId]);

  const change = async (run: () => Promise<{ ok: boolean; error?: string }>) => {
    if (busy) return;
    setBusy(true);
    const r = await run();
    setBusy(false);
    if (!r.ok) return toast(r.error ?? t("That didn't work."), { kind: "err" });
    await load();
    // (the shelf's averages and counts behind the box)
    router.refresh();
  };
  const mine = talk?.mine;
  const shown = mine?.rating ?? null;
  // (the others who want to play it: you're the button)
  const others = (talk?.wants ?? []).filter((p) => p.id !== me?.id);
  const pic = card?.image ?? card?.thumb ?? game.thumb;

  return (
    <Modal title={game.year ? `${game.name} (${game.year})` : game.name} onClose={onClose}>
      <div className="game-dialog stack">
        <div className="game-dialog-top">
          <span className="game-dialog-box">{pic ? <img src={pic} alt="" referrerPolicy="no-referrer" /> : null}</span>
          <div className="stack tight" style={{ minWidth: 0 }}>
            <span className="game-dialog-facts">
              {game.players ? (
                <span>
                  <Users size={14} aria-hidden /> {t.n(game.players[1], "{n} player", "{n} players", { n: span(game.players) })}
                </span>
              ) : null}
              {game.time ? (
                <span>
                  <Clock size={14} aria-hidden /> {t("{n} min", { n: span(game.time) })}
                </span>
              ) : null}
              {card?.weight ? (
                <span title={t("Complexity on BoardGameGeek, 1–5")}>
                  <Scale size={14} aria-hidden /> {t("Weight {n} / 5", { n: one(card.weight) })}
                </span>
              ) : null}
              {game.rating ? (
                <span title={t("Rated {n} on BoardGameGeek", { n: one(game.rating) })}>
                  <Star size={14} aria-hidden /> {one(game.rating)} BGG
                </span>
              ) : null}
              {game.rank ? (
                <span title={t("Number {n} on BoardGameGeek", { n: game.rank })}>
                  <Trophy size={14} aria-hidden /> #{game.rank}
                </span>
              ) : null}
            </span>
            <a className="small link row" style={{ gap: 4 }} href={`https://boardgamegeek.com/boardgame/${game.id}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={13} aria-hidden /> {t("Open on BoardGameGeek")}
            </a>
          </div>
        </div>

        <section className="game-dialog-part">
          <h3 className="game-dialog-h">{t("Your rating")}</h3>
          <div className="game-rate" role="group" aria-label={t("Your rating, 1 to 10")}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" className={`game-rate-n ${shown === n ? "on" : ""} ${shown && n <= shown ? "lit" : ""}`} aria-pressed={shown === n} disabled={!talk || busy} onClick={() => change(() => rateGameAction(game.id, shown === n ? null : n))}>
                {n}
              </button>
            ))}
          </div>
          {shown === null && mine?.bggRating ? <p className="tiny muted" style={{ margin: 0 }}>{t("You gave it {n} on BoardGameGeek: that counts until you rate it here.", { n: mine.bggRating })}</p> : null}
        </section>

        <section className="game-dialog-part row wrap" style={{ gap: 10 }}>
          <button type="button" className={`btn btn-sm ${mine?.want ? "btn-primary" : ""}`} aria-pressed={!!mine?.want} disabled={!talk || busy} onClick={() => change(() => wantGameAction(game.id, !mine?.want))}>
            <Heart size={15} fill={mine?.want ? "currentColor" : "none"} aria-hidden /> {mine?.want ? t("You want to play it") : t("Want to play")}
          </button>
          {others.length ? (
            <span className="small muted row" style={{ gap: 6 }}>
              <span className="avatar-stack">
                {others.slice(0, 5).map((p) => (
                  <Avatar key={p.id} user={p} size={22} />
                ))}
              </span>
              {t.n(others.length, "{n} wants to play it", "{n} want to play it")}: {others.map((p) => first(p.name)).join(", ")}
            </span>
          ) : null}
        </section>

        {talk?.ratings.length ? (
          <section className="game-dialog-part">
            <h3 className="game-dialog-h">
              {groupId ? t("Rated by the group") : t("Rated here")} · {talk.avg !== null ? one(talk.avg) : "–"}
            </h3>
            <ul className="game-dialog-people">
              {talk.ratings.map((r) => (
                <li key={r.user.id}>
                  <Avatar user={r.user} size={24} />
                  <span className="grow">{first(r.user.name)}</span>
                  <b>{r.rating}</b>
                  {r.fromBgg ? <span className="tiny faint">BGG</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {talk?.owners.length ? (
          <section className="game-dialog-part">
            <h3 className="game-dialog-h">{groupId ? t("In the group, it's on the shelf of") : t("On the shelf of")}</h3>
            <span className="row wrap small" style={{ gap: "6px 12px" }}>
              {talk.owners.map((p) => (
                <span key={p.id} className="row" style={{ gap: 6 }}>
                  <Avatar user={p} size={22} /> {first(p.name)}
                </span>
              ))}
            </span>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
