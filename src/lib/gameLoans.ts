import "server-only";
import { db, now, tx } from "./db";
import { UserError } from "./errors";
import { notify } from "./notify";
import { summaries, type User } from "./users";
import type { GameLoan, LoanStatus } from "./types";

/**
 * Lending games off the game shelves (bggShelf.ts): someone asks to borrow a game a member owns, the
 * owner lends it or says no, and it's lent until it's given back (either of them says so). Each step
 * tells the other one (the "loan" notifications), and the link opens the game's box on the owner's
 * shelf, where the loan is.
 */

interface Row {
  id: number;
  game_id: number;
  owner_id: number;
  borrower_id: number;
  status: LoanStatus;
  asked_at: number;
  answered_at: number | null;
  returned_at: number | null;
}

const open = "status in ('asked', 'lent')";

function gameName(ownerId: number, gameId: number): string | null {
  return (db().prepare("select name from bgg_shelf where user_id = ? and game_id = ?").get(ownerId, gameId) as { name: string } | undefined)?.name ?? null;
}
const boxUrl = (ownerId: number, gameId: number) => {
  const name = (db().prepare("select username from users where id = ?").get(ownerId) as { username: string } | undefined)?.username ?? "";
  return `/u/${encodeURIComponent(name)}?tab=games&game=${gameId}`;
};

function loanRow(id: number): Row {
  const r = db().prepare("select * from game_loans where id = ?").get(id) as Row | undefined;
  if (!r) throw new UserError("That loan isn't there.");
  return r;
}

/** Ask to borrow a game off someone's shelf. */
export function askLoan(u: User, ownerId: number, gameId: number): number {
  if (ownerId === u.id) throw new UserError("That's your own game.");
  const name = gameName(ownerId, gameId);
  if (!name) throw new UserError("That game isn't on their shelf.");
  if (db().prepare(`select 1 from game_loans where owner_id = ? and game_id = ? and borrower_id = ? and ${open}`).get(ownerId, gameId, u.id)) throw new UserError("You've asked already.");
  if (db().prepare("select 1 from game_loans where owner_id = ? and game_id = ? and status = 'lent'").get(ownerId, gameId)) throw new UserError("It's lent out just now.");
  const id = Number(db().prepare("insert into game_loans (game_id, owner_id, borrower_id, status, asked_at) values (?, ?, ?, 'asked', ?)").run(gameId, ownerId, u.id, now()).lastInsertRowid);
  notify([ownerId], { kind: "loan", actorId: u.id, title: "{name} would like to borrow {game}", vars: { name: u.name, game: name }, url: boxUrl(ownerId, gameId), tag: `loan-${id}` });
  return id;
}

/** The owner's answer: lend it, or not. */
export function answerLoan(u: User, loanId: number, yes: boolean) {
  const r = loanRow(loanId);
  if (r.owner_id !== u.id) throw new UserError("Only its owner can answer that.");
  if (r.status !== "asked") throw new UserError("That's been answered already.");
  if (yes && db().prepare("select 1 from game_loans where owner_id = ? and game_id = ? and status = 'lent'").get(r.owner_id, r.game_id)) throw new UserError("It's lent out just now.");
  const name = gameName(r.owner_id, r.game_id) ?? "";
  tx(() => {
    db().prepare("update game_loans set status = ?, answered_at = ? where id = ?").run(yes ? "lent" : "declined", now(), loanId);
    // (lent to one: the others who asked hear it's taken, for now)
    if (yes) db().prepare("update game_loans set status = 'declined', answered_at = ? where owner_id = ? and game_id = ? and status = 'asked' and id != ?").run(now(), r.owner_id, r.game_id, loanId);
  });
  notify([r.borrower_id], { kind: "loan", actorId: u.id, title: yes ? "{name} lends you {game}" : "{name} can't lend you {game} just now", vars: { name: u.name, game: name }, url: boxUrl(r.owner_id, r.game_id), tag: `loan-${loanId}` });
}

/** Given back (the owner or the borrower says so). */
export function returnLoan(u: User, loanId: number) {
  const r = loanRow(loanId);
  if (r.owner_id !== u.id && r.borrower_id !== u.id) throw new UserError("That loan isn't yours.");
  if (r.status !== "lent") throw new UserError("That game isn't lent out.");
  db().prepare("update game_loans set status = 'returned', returned_at = ? where id = ?").run(now(), loanId);
  const other = u.id === r.owner_id ? r.borrower_id : r.owner_id;
  notify([other], { kind: "loan", actorId: u.id, title: "{name} says {game} is back home", vars: { name: u.name, game: gameName(r.owner_id, r.game_id) ?? "" }, url: boxUrl(r.owner_id, r.game_id), tag: `loan-${loanId}` });
}

/** The borrower takes back their asking. */
export function cancelLoan(u: User, loanId: number) {
  const r = loanRow(loanId);
  if (r.borrower_id !== u.id) throw new UserError("That loan isn't yours.");
  if (r.status !== "asked") throw new UserError("That's been answered already.");
  db().prepare("update game_loans set status = 'cancelled', answered_at = ? where id = ?").run(now(), loanId);
}

const toLoans = (rows: Row[]): GameLoan[] => {
  const people = summaries(rows.flatMap((r) => [r.owner_id, r.borrower_id]));
  return rows
    .map((r) => ({
      id: r.id,
      gameId: r.game_id,
      game: gameName(r.owner_id, r.game_id) ?? "",
      owner: people.get(r.owner_id)!,
      borrower: people.get(r.borrower_id)!,
      status: r.status,
      askedAt: r.asked_at,
      since: r.answered_at,
    }))
    .filter((l) => l.owner && l.borrower);
};

/** A game's open loans (asked or lent) that a viewer takes part in or owns the game of. */
export function gameLoans(u: User, gameId: number): GameLoan[] {
  // (where it's lent everyone may see; who asked, only those two)
  const rows = (db().prepare(`select * from game_loans where game_id = ? and ${open} order by asked_at`).all(gameId) as Row[]).filter((r) => r.status === "lent" || r.owner_id === u.id || r.borrower_id === u.id);
  return toLoans(rows);
}

/** Their open loans: asked of them, lent out by them, and borrowed or asked for by them. */
export function myLoans(u: User): GameLoan[] {
  return toLoans(db().prepare(`select * from game_loans where (owner_id = ? or borrower_id = ?) and ${open} order by asked_at`).all(u.id, u.id) as Row[]);
}

/** Which of these owners' games are lent out just now (for the shelves): "owner:game" → the borrower's id. */
export function lentOut(ownerIds: number[]): Record<string, number> {
  if (!ownerIds.length) return {};
  const rows = db()
    .prepare(`select owner_id, game_id, borrower_id from game_loans where status = 'lent' and owner_id in (${ownerIds.map(() => "?").join(",")})`)
    .all(...ownerIds) as { owner_id: number; game_id: number; borrower_id: number }[];
  return Object.fromEntries(rows.map((r) => [`${r.owner_id}:${r.game_id}`, r.borrower_id]));
}
