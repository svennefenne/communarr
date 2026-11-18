"use server";

import { revalidatePath } from "next/cache";
import { act } from "@/lib/act";
import { UserError } from "@/lib/errors";
import { canReadGroup, groupRow } from "@/lib/groups";
import { gameTalk, rateGame, wantGame } from "@/lib/gameMarks";
import { bringGame, bringOptions, leaveGame } from "@/lib/eventGames";
import { shelfGames } from "@/lib/bggShelf";

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

/** Bring a game off their shelf to an event (or leave it at home again). */
export async function bringGameAction(eventId: number, gameId: number, on: boolean) {
  return act((u) => {
    if (on) bringGame(u, Number(eventId), Number(gameId));
    else leaveGame(u, Number(eventId), Number(gameId));
    revalidatePath(`/events/${Number(eventId)}`);
    return true;
  });
}

/** The coming events they could bring a game to. */
export async function bringOptionsAction(gameId: number) {
  return act((u) => bringOptions(u, Number(gameId)));
}

/** Their own shelf (to pick games to bring). */
export async function myShelfAction() {
  return act((u) => shelfGames(u.id));
}
