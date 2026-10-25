"use server";

import { revalidatePath } from "next/cache";
import { act } from "@/lib/act";
import { audit } from "@/lib/auth";
import { UserError } from "@/lib/errors";
import { BggError, checkBggToken, setBggToken } from "@/lib/bgg";

/**
 * The BoardGameGeek token (Admin → Features & permissions), tried on BGG before it's kept; "" takes
 * it away. checked: false when BGG didn't answer to try it (it's kept all the same).
 */
export async function setBggTokenAction(token: string) {
  return act(async (u) => {
    if (!u.isAdmin) throw new UserError("Only admins can do that.");
    const t = String(token ?? "").trim();
    if (t.length > 500 || /\s/.test(t)) throw new UserError("That doesn't look like a token.");
    let checked = true;
    if (t) {
      try {
        await checkBggToken(t);
      } catch (e) {
        if (e instanceof BggError && e.kind === "token") throw new UserError("BoardGameGeek didn't accept that token.");
        checked = false;
      }
    }
    setBggToken(t);
    audit(u.id, t ? "bgg token set" : "bgg token removed");
    revalidatePath("/", "layout");
    return { checked };
  });
}
