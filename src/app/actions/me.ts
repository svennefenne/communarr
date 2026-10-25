"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, now } from "@/lib/db";
import { endSession, requireUser } from "@/lib/auth";
import { refreshPresence, broadcast } from "@/lib/hub";
import { PALETTE_BY_SLUG } from "@/lib/palettes";
import type { Presence, ThemePrefs } from "@/lib/types";
import { themeFor } from "@/lib/themes";

export async function logoutAction() {
  await endSession();
  redirect("/login");
}

/** Change some of your display preferences (scheme, mode, wipes, motion, text size, density, theme). */
export async function setPrefsAction(patch: Partial<ThemePrefs>) {
  const u = await requireUser();
  const next: ThemePrefs = { ...u.theme };
  if (typeof patch.scheme === "string" && PALETTE_BY_SLUG.has(patch.scheme)) {
    next.scheme = patch.scheme;
    if (patch.custom === undefined) next.custom = null;
  }
  if (patch.mode === "dark" || patch.mode === "light" || patch.mode === "system") next.mode = patch.mode;
  if (typeof patch.wipes === "boolean") next.wipes = patch.wipes;
  if (typeof patch.motion === "boolean") next.motion = patch.motion;
  if (typeof patch.sounds === "boolean") next.sounds = patch.sounds;
  if (typeof patch.textSize === "number") next.textSize = Math.max(85, Math.min(130, Math.round(patch.textSize)));
  if (patch.density === "comfy" || patch.density === "compact") next.density = patch.density;
  if (patch.custom === null) next.custom = null;
  else if (typeof patch.custom === "number") {
    const t = themeFor(patch.custom, u.id);
    if (t) next.custom = t.id;
  }
  db().prepare("update users set theme_json = ? where id = ?").run(JSON.stringify(next), u.id);
  revalidatePath("/", "layout");
  return next;
}

const UNTIL: Record<string, number | null> = { never: null, "30m": 30 * 60_000, "1h": 3600_000, "4h": 4 * 3600_000, today: -1, week: 7 * 86_400_000 };

/** Your status line (an emoji and a few words) and how you show up (auto, away, busy, invisible). */
export async function setStatusAction(input: { emoji: string; text: string; clear: string; presence: Presence }) {
  const u = await requireUser();
  const emoji = [...(input.emoji || "")].slice(0, 2).join("");
  const text = (input.text || "").trim().slice(0, 100);
  let until: number | null = null;
  const d = UNTIL[input.clear] ?? null;
  if (d === -1) {
    const e = new Date();
    e.setHours(23, 59, 59, 999);
    until = e.getTime();
  } else if (d) until = now() + d;
  const presence: Presence = ["auto", "away", "busy", "invisible"].includes(input.presence) ? input.presence : "auto";
  db().prepare("update users set status_emoji = ?, status_text = ?, status_until = ?, presence = ? where id = ?").run(emoji, text, emoji || text ? until : null, presence, u.id);
  refreshPresence(u.id);
  broadcast("status", { id: u.id, emoji, text });
  revalidatePath("/", "layout");
  return { ok: true };
}
