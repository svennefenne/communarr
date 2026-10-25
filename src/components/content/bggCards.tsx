"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import type { BggGame } from "@/lib/types";
import type { T } from "@/lib/i18n";
import { useT } from "@/components/app/AppProvider";

/**
 * Board games from BoardGameGeek in what people wrote (bgg: chips and plain links to a game's page):
 * their details come from BGG's API through the site (/api/bgg/game/…), since BGG turns away
 * fetching its pages for a preview.
 */

// one request per game while the page is open
const games = new Map<number, Promise<BggGame | null>>();
export function loadGame(id: number): Promise<BggGame | null> {
  let p = games.get(id);
  if (!p) {
    p = fetch(`/api/bgg/game/${id}`)
      .then((r) => r.json() as Promise<{ game?: BggGame | null; error?: string }>)
      .then((d) => {
        if (d.error) games.delete(id);
        return d.game ?? null;
      })
      .catch(() => {
        games.delete(id);
        return null;
      });
    games.set(id, p);
  }
  return p;
}

const span = (r: [number, number]) => (r[0] === r[1] ? String(r[0]) : `${r[0]}–${r[1]}`);

/** "1–5 players · 40–70 min · ★ 8.0" (in the reader's language) */
export function gameFacts(t: T, g: BggGame): string {
  return [
    g.players ? t.n(g.players[1], "{n} player", "{n} players", { n: span(g.players) }) : null,
    g.time ? t("{n} min", { n: span(g.time) }) : null,
    g.rating ? `★ ${g.rating.toLocaleString(t.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// cards come after the text is drawn: "hd:grew" lets a chat that was at its bottom stay there
const grew = () => window.dispatchEvent(new Event("hd:grew"));

/** A link to a game's page, as a card under the text: its box, name, year and a few facts. */
export function GameLinkCard({ id, url }: { id: number; url: string }) {
  const t = useT();
  const [game, setGame] = useState<BggGame | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void loadGame(id).then((g) => live && setGame(g));
    return () => {
      live = false;
    };
  }, [id]);
  useLayoutEffect(() => {
    if (game) grew();
  }, [game]);
  if (!game) return null;
  const pic = game.thumb ?? game.image;
  return (
    <a className={`link-card bgg-card ${pic ? "" : "no-pic"}`} href={url} target="_blank" rel="noopener noreferrer nofollow ugc">
      {pic ? <img className="link-card-pic" src={pic} alt="" loading="lazy" referrerPolicy="no-referrer" onLoad={grew} /> : null}
      <span className="link-card-text">
        <span className="link-card-site">BoardGameGeek</span>
        <b className="link-card-title">
          {game.name}
          {game.year ? ` (${game.year})` : ""}
        </b>
        <span className="link-card-desc">{gameFacts(t, game)}</span>
        <span className="bgg-powered">{t("Powered by BGG")}</span>
      </span>
    </a>
  );
}
