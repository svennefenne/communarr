"use server";

import { act } from "@/lib/act";
import { UserError } from "@/lib/errors";
import { canReadGroup, groupRow } from "@/lib/groups";
import { gameTalk, rateGame, wantGame } from "@/lib/gameMarks";

/** A game's box on a shelf (a group's: its members' ratings and wishes; else everyone's). */
export async function gameTalkAction(gameId: number, groupId?: number) {
  return act((u) => {
    if (groupId) {
      const g = groupRow(groupId);
      if (!g || !canReadGroup(u, g)) throw new UserError("That group isn't there.");
    }
    return gameTalk(u.id, Number(gameId), groupId || undefined);
  });
}

export async function rateGameAction(gameId: number, rating: number | null) {
  return act((u) => {
    rateGame(u.id, Number(gameId), rating === null ? null : Number(rating));
    return true;
  });
}

export async function wantGameAction(gameId: number, on: boolean) {
  return act((u) => {
    wantGame(u.id, Number(gameId), !!on);
    return true;
  });
}
