"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Dices, Heart, Plus, Search, X } from "lucide-react";
import type { BroughtGame, ShelfGame } from "@/lib/types";
import { useT, useToast } from "@/components/app/AppProvider";
import { Modal } from "@/components/ui/ui";
import { Avatar } from "@/components/ui/Avatar";
import { GameDialog } from "@/components/profile/GameDialog";
import { bringGameAction, myShelfAction } from "@/app/actions/games";

/**
 * The games coming along to an event (lib/eventGames.ts): each with who brings it, whether it fits the
 * number coming, and how many of those coming want to play it; and for someone coming who has a game
 * shelf, "Bring a game" to pick from it.
 */

const span = (r: [number, number]) => (r[0] === r[1] ? String(r[0]) : `${r[0]}–${r[1]}`);

function Box({ g }: { g: ShelfGame }) {
  return <span className="shelf-box">{g.thumb ? <img src={g.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Dices size={22} aria-hidden />}</span>;
}

export function EventGames({ eventId, groupId, list, coming, canBring, hint }: { eventId: number; groupId?: number; list: BroughtGame[]; coming: number; canBring: boolean; hint: string | null }) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState<ShelfGame | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const bring = async (gameId: number, on: boolean) => {
    setBusy(gameId);
    const r = await bringGameAction(eventId, gameId, on);
    setBusy(null);
    if (!r.ok) return toast(r.error, { kind: "err" });
    router.refresh();
  };
  // does it suit the number coming: fits, or (too few or too many) its own number of players
  const fit = (g: ShelfGame) => {
    if (!g.players || !coming) return null;
    const ok = coming >= g.players[0] && coming <= g.players[1];
    return ok ? (
      <span className="event-game-fit ok">
        <Check size={12} aria-hidden /> {t("Fits the {n} coming", { n: coming })}
      </span>
    ) : (
      <span className="event-game-fit">{t.n(g.players[1], "For {range} player", "For {range} players", { range: span(g.players) })}</span>
    );
  };

  return (
    <section className="panel panel-pad stack event-games">
      <div className="row between wrap" style={{ gap: 10 }}>
        <span className="eyebrow">
          {t("Games coming along")}
          {list.length ? ` · ${list.length}` : ""}
        </span>
        {canBring ? (
          <button type="button" className="btn btn-sm" onClick={() => setPicking(true)}>
            <Plus size={15} /> {t("Bring a game")}
          </button>
        ) : null}
      </div>
      {list.length ? (
        <ul className="event-game-list">
          {list.map((b) => (
            <li key={`${b.by.id}-${b.game.id}`} className="event-game">
              <button type="button" className="event-game-main" onClick={() => setOpen(b.game)}>
                <Box g={b.game} />
                <span className="event-game-text">
                  <b className="ellipsis">{b.game.name}</b>
                  <span className="event-game-meta">
                    <span className="row" style={{ gap: 5 }}>
                      <Avatar user={b.by} size={18} /> {b.mine ? t("brought by you") : t("brought by {name}", { name: b.by.name.split(" ")[0] })}
                    </span>
                    {b.game.time ? <span>{t("{n} min", { n: span(b.game.time) })}</span> : null}
                    {b.wants ? (
                      <span className="event-game-wants" title={t.n(b.wants, "{n} wants to play it", "{n} want to play it")}>
                        <Heart size={12} aria-hidden /> {b.wants}
                      </span>
                    ) : null}
                  </span>
                  {fit(b.game)}
                </span>
              </button>
              {b.mine ? (
                <button type="button" className="icon-btn sm" disabled={busy === b.game.id} onClick={() => bring(b.game.id, false)} aria-label={t("Leave {game} at home", { game: b.game.name })} title={t("Leave it at home")}>
                  <X size={16} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>
          {canBring ? t("No games yet: bring something off your game shelf.") : t("No games yet.")}
        </p>
      )}
      {hint ? (
        <p className="tiny muted" style={{ margin: 0 }}>
          {hint}
        </p>
      ) : null}
      {picking ? <Picker brought={new Set(list.filter((b) => b.mine).map((b) => b.game.id))} busy={busy} onBring={bring} onClose={() => setPicking(false)} /> : null}
      {open ? <GameDialog game={open} groupId={groupId} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}

/** Their own shelf, to pick games to bring. */
function Picker({ brought, busy, onBring, onClose }: { brought: Set<number>; busy: number | null; onBring: (gameId: number, on: boolean) => Promise<unknown>; onClose: () => void }) {
  const t = useT();
  const [games, setGames] = useState<ShelfGame[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    void myShelfAction().then((r) => setGames(r.ok ? r.data : []));
  }, []);
  const needle = q.trim().toLocaleLowerCase(t.locale);
  const shown = (games ?? []).filter((g) => !needle || g.name.toLocaleLowerCase(t.locale).includes(needle));
  return (
    <Modal title={t("Bring a game")} onClose={onClose}>
      <div className="stack">
        <label className="chat-search" style={{ margin: 0 }}>
          <Search size={15} aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Find a game")} aria-label={t("Find a game")} autoFocus />
        </label>
        <ul className="event-pick">
          {games === null ? <li className="small muted">{t("Loading…")}</li> : null}
          {shown.map((g) => {
            const on = brought.has(g.id);
            return (
              <li key={g.id}>
                <Box g={g} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <b className="ellipsis" style={{ display: "block" }}>
                    {g.name}
                  </b>
                  <span className="tiny muted">
                    {g.players ? t.n(g.players[1], "{n} player", "{n} players", { n: span(g.players) }) : ""}
                    {g.players && g.time ? " · " : ""}
                    {g.time ? t("{n} min", { n: span(g.time) }) : ""}
                  </span>
                </span>
                <button type="button" className={`btn btn-sm ${on ? "btn-primary" : ""}`} disabled={busy === g.id} aria-pressed={on} onClick={() => onBring(g.id, !on)}>
                  {on ? (
                    <>
                      <Check size={14} /> {t("Bringing it")}
                    </>
                  ) : (
                    t("Bring it")
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
