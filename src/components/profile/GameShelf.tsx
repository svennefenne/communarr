"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Clock, Dices, Search, Star, Users } from "lucide-react";
import type { ShelfGame, UserSummary } from "@/lib/types";
import type { T } from "@/lib/i18n";
import { useT } from "@/components/app/AppProvider";
import { Empty } from "@/components/ui/ui";
import { Avatar } from "@/components/ui/Avatar";
import { Time } from "@/components/ui/Time";

/**
 * A member's game shelf on their profile: the board games they own on BoardGameGeek (lib/bggShelf.ts);
 * and a group's, every game its members own with who has it. The whole shelf, to look through: by name,
 * how many can play, how long it takes (and in a group, whose); and a small one for the profile's side
 * column. Each game links to its page on BGG, and resting the pointer on it shows its card there
 * (LinkPeek, through .shelf).
 */

const bggUrl = (id: number) => `https://boardgamegeek.com/boardgame/${id}`;
const span = (r: [number, number]) => (r[0] === r[1] ? String(r[0]) : `${r[0]}–${r[1]}`);

const PLAYERS = [1, 2, 3, 4, 5, 6] as const;
type Length = "any" | "30" | "60" | "120" | "long";
type Sort = "name" | "rating" | "mine" | "short" | "added" | "plays" | "owners";
type Person = Pick<UserSummary, "id" | "name" | "avatar" | "accent">;
/** one member's shelf (their first name, their name on BGG), or a group's (its members with games, and who owns which) */
export type Whose = { kind: "member"; owner: string; bggName: string; fetchedAt: number | null } | { kind: "group"; people: Person[]; owners: Record<number, number[]> };

const fitsPlayers = (g: ShelfGame, n: number | null) => !n || (!!g.players && (n === 6 ? g.players[1] >= 6 : g.players[0] <= n && n <= g.players[1]));
function fitsLength(g: ShelfGame, l: Length) {
  if (l === "any") return true;
  if (!g.time) return false;
  return l === "long" ? g.time[1] > 120 : g.time[1] <= Number(l);
}

function Facts({ g, t }: { g: ShelfGame; t: T }) {
  const one = (n: number) => n.toLocaleString(t.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <span className="shelf-facts">
      {g.players ? (
        <span title={t.n(g.players[1], "{n} player", "{n} players", { n: span(g.players) })}>
          <Users size={12} aria-hidden /> {span(g.players)}
        </span>
      ) : null}
      {g.time ? (
        <span title={t("{n} min", { n: span(g.time) })}>
          <Clock size={12} aria-hidden /> {span(g.time)}
        </span>
      ) : null}
      {g.rating ? (
        <span title={t("Rated {n} on BoardGameGeek", { n: one(g.rating) })}>
          <Star size={12} aria-hidden /> {one(g.rating)}
        </span>
      ) : null}
    </span>
  );
}

function Box({ g }: { g: ShelfGame }) {
  return <span className="shelf-box">{g.thumb ? <img src={g.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Dices size={28} aria-hidden />}</span>;
}

/** Who in the group has it: their pictures (a few, then how many more). */
function Owners({ ids, people }: { ids: number[]; people: Map<number, Person> }) {
  const who = ids.map((id) => people.get(id)).filter((p): p is Person => !!p);
  const names = who.map((p) => p.name.split(" ")[0]).join(", ");
  return (
    <span className="shelf-owners" title={names}>
      {who.slice(0, 4).map((p) => (
        <Avatar key={p.id} user={p} size={22} />
      ))}
      {who.length > 4 ? <span className="shelf-more">+{who.length - 4}</span> : null}
      <span className="sr-only">{names}</span>
    </span>
  );
}

/** The whole shelf (a profile's or a group's "Game shelf" tab). */
export function GameShelf({ games, whose }: { games: ShelfGame[]; whose: Whose }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [players, setPlayers] = useState<number | null>(null);
  const [length, setLength] = useState<Length>("any");
  const [sort, setSort] = useState<Sort>("name");
  // (a group's: whose games, everyone's or one member's)
  const [who, setWho] = useState<number | null>(null);
  const group = whose.kind === "group" ? whose : null;
  const people = useMemo(() => new Map((group?.people ?? []).map((p) => [p.id, p])), [group]);
  const rated = games.some((g) => g.mine);
  const played = games.some((g) => g.plays);

  const shown = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase(t.locale);
    const owners = group?.owners ?? {};
    const list = games.filter((g) => (!needle || g.name.toLocaleLowerCase(t.locale).includes(needle)) && fitsPlayers(g, players) && fitsLength(g, length) && (!who || !!owners[g.id]?.includes(who)));
    const byName = (a: ShelfGame, b: ShelfGame) => a.name.localeCompare(b.name, t.locale);
    const by: Record<Sort, (a: ShelfGame, b: ShelfGame) => number> = {
      name: byName,
      rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || byName(a, b),
      mine: (a, b) => (b.mine ?? 0) - (a.mine ?? 0) || byName(a, b),
      short: (a, b) => (a.time?.[1] ?? Infinity) - (b.time?.[1] ?? Infinity) || byName(a, b),
      added: (a, b) => (b.added ?? 0) - (a.added ?? 0) || byName(a, b),
      plays: (a, b) => b.plays - a.plays || byName(a, b),
      owners: (a, b) => (owners[b.id]?.length ?? 0) - (owners[a.id]?.length ?? 0) || byName(a, b),
    };
    return list.sort(by[sort]);
  }, [games, q, players, length, sort, who, group, t.locale]);
  const filtered = !!q.trim() || players !== null || length !== "any" || who !== null;

  return (
    <section className="shelf stack">
      <div className="panel panel-pad shelf-bar">
        <label className="chat-search shelf-search">
          <Search size={15} aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Find a game")} aria-label={t("Find a game")} />
        </label>
        <div className="shelf-players" role="group" aria-label={t("How many are playing")}>
          <Users size={15} className="muted" aria-hidden />
          <div className="pills">
            <button type="button" className={`pill ${players === null ? "active" : ""}`} aria-pressed={players === null} onClick={() => setPlayers(null)}>
              {t("Any")}
            </button>
            {PLAYERS.map((n) => (
              <button key={n} type="button" className={`pill ${players === n ? "active" : ""}`} aria-pressed={players === n} onClick={() => setPlayers(players === n ? null : n)} title={t.n(n, "{n} player", "{n} players")}>
                {n === 6 ? "6+" : n}
              </button>
            ))}
          </div>
        </div>
        <select className="select shelf-select" value={length} onChange={(e) => setLength(e.target.value as Length)} aria-label={t("Playing time")}>
          <option value="any">{t("Any length")}</option>
          <option value="30">{t("Up to 30 minutes")}</option>
          <option value="60">{t("Up to an hour")}</option>
          <option value="120">{t("Up to two hours")}</option>
          <option value="long">{t("Longer than two hours")}</option>
        </select>
        {group && group.people.length > 1 ? (
          <select className="select shelf-select" value={who ?? ""} onChange={(e) => setWho(e.target.value ? Number(e.target.value) : null)} aria-label={t("Whose games")}>
            <option value="">{t("Everyone's games")}</option>
            {group.people.map((p) => (
              <option key={p.id} value={p.id}>
                {t("Games {name} has", { name: p.name.split(" ")[0] })}
              </option>
            ))}
          </select>
        ) : null}
        <select className="select shelf-select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={t("Order")}>
          <option value="name">{t("By name")}</option>
          <option value="rating">{t("Best rated on BGG")}</option>
          {rated && whose.kind === "member" ? <option value="mine">{t("Rated highest by {name}", { name: whose.owner })}</option> : null}
          {group ? <option value="owners">{t("Most of us have it")}</option> : null}
          <option value="short">{t("Shortest first")}</option>
          <option value="added">{t("Newest on the shelf")}</option>
          {played ? <option value="plays">{t("Most played")}</option> : null}
        </select>
      </div>
      <p className="small muted" style={{ margin: 0 }} aria-live="polite">
        {filtered ? t("{n} of {total} games", { n: shown.length, total: games.length }) : t.n(games.length, "{n} game", "{n} games")}
      </p>
      {shown.length ? (
        <ul className="shelf-grid">
          {shown.map((g) => (
            <li key={g.id}>
              <a className="shelf-game" href={bggUrl(g.id)} target="_blank" rel="noopener noreferrer">
                <Box g={g} />
                <b className="shelf-name">{g.name}</b>
                {g.year ? <span className="shelf-year">{g.year}</span> : null}
                <Facts g={g} t={t} />
                {group ? <Owners ids={group.owners[g.id] ?? []} people={people} /> : null}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <Empty icon={<Dices size={28} />} title={t("No game fits")}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setQ("");
              setPlayers(null);
              setLength("any");
              setWho(null);
            }}
          >
            {t("Show them all")}
          </button>
        </Empty>
      )}
      <p className="tiny muted shelf-credit">
        {whose.kind === "member" ? (
          <>
            <a href={`https://boardgamegeek.com/collection/user/${encodeURIComponent(whose.bggName)}?own=1&subtype=boardgame`} target="_blank" rel="noopener noreferrer" className="link">
              {t("The collection on BoardGameGeek")}
            </a>
            {whose.fetchedAt ? (
              <>
                {", "}
                {t("fetched")} <Time t={whose.fetchedAt} />
              </>
            ) : null}
          </>
        ) : (
          t.n(whose.people.length, "From {n} member's collection on BoardGameGeek", "From {n} members' collections on BoardGameGeek")
        )}
        {" · "}
        <a href="https://boardgamegeek.com" target="_blank" rel="noopener noreferrer" className="bgg-powered">
          {t("Powered by BGG")}
        </a>
      </p>
    </section>
  );
}

/** The profile's side column: a few of their games, and the way to the whole shelf. */
export function ShelfCard({ games, total, href }: { games: ShelfGame[]; total: number; href: string }) {
  const t = useT();
  return (
    <section className="panel shelf shelf-card">
      <div className="panel-head">
        <span className="eyebrow">{t("Game shelf")}</span>
        <Link href={href} className="small link">
          {t.n(total, "{n} game", "{n} games")}
        </Link>
      </div>
      <ul className="shelf-mini">
        {games.map((g) => (
          <li key={g.id}>
            <a href={bggUrl(g.id)} target="_blank" rel="noopener noreferrer" aria-label={g.name}>
              <Box g={g} />
            </a>
          </li>
        ))}
      </ul>
      <Link href={href} className="shelf-all small">
        {t("See the whole shelf")} →
      </Link>
    </section>
  );
}

/** Their own profile, before they've linked BoardGameGeek (or while it's being fetched). */
export function ShelfInvite({ pending }: { pending: boolean }) {
  const t = useT();
  return (
    <section className="panel panel-pad shelf-card">
      <span className="eyebrow">{t("Game shelf")}</span>
      <p className="small muted" style={{ margin: "8px 0 0" }}>
        {pending ? t("Fetching your games from BoardGameGeek. They turn up here in a minute or two.") : t("Show the board games you own here: give your name on BoardGameGeek.")}
      </p>
      {pending ? null : (
        <Link href="/settings" className="btn btn-sm" style={{ marginTop: 10 }}>
          <Dices size={15} /> {t("Link BoardGameGeek")}
        </Link>
      )}
    </section>
  );
}
