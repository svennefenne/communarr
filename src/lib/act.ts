import "server-only";
import { requireUser } from "./auth";
import { UserError } from "./errors";
import type { User } from "./users";
import type { ActionResult } from "./types";

/** Run a server action as the signed-in member: rule errors come back as messages, bugs as a plain apology. */
export async function act<T>(fn: (u: User) => T | Promise<T>): Promise<ActionResult<T>> {
  const u = await requireUser();
  try {
    return { ok: true, data: await fn(u) };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    // redirect() and notFound() inside an action must pass through
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error(e);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
