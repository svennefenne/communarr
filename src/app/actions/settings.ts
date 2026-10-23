"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { act } from "@/lib/act";
import { UserError } from "@/lib/errors";
import { currentSessionId, endSession } from "@/lib/auth";
import { changePassword, changeUsername, deleteOwnAccount, endSessionById, setNotifyPrefs, updateProfile, type ProfileInput } from "@/lib/profile";
import { saveTheme } from "@/lib/themes";
import { cleanTheme, type ThemeData } from "@/lib/theme";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { resetFeedToken } from "@/lib/events";
import type { NotifyKind } from "@/lib/types";

export async function updateProfileAction(input: ProfileInput) {
  return act((u) => {
    updateProfile(u, input);
    revalidatePath("/", "layout");
    return true;
  });
}

export async function changePasswordAction(current: string, next: string) {
  const sid = await currentSessionId();
  return act(async (u) => {
    await changePassword(u, current, next, sid);
    return true;
  });
}

export async function changeUsernameAction(username: string) {
  return act((u) => {
    changeUsername(u, username.trim());
    revalidatePath("/", "layout");
    return username.trim();
  });
}

export async function endSessionAction(id: string) {
  return act((u) => {
    endSessionById(u.id, id);
    return true;
  });
}

export async function notifyPrefsAction(input: Partial<Record<NotifyKind, { app?: boolean; push?: boolean }>> & { quietFrom?: string; quietTo?: string; tz?: string }) {
  return act((u) => setNotifyPrefs(u, input));
}

export async function deleteAccountAction(confirmName: string) {
  const r = await act((u) => {
    if (confirmName.trim().toLowerCase() !== u.username.toLowerCase()) throw new UserError("Type your username to confirm.");
    deleteOwnAccount(u);
    return true;
  });
  if (!r.ok) return r;
  await endSession();
  redirect("/login");
}

export async function saveThemeAction(id: number | null, name: string, data: ThemeData, shared: boolean, use: boolean) {
  return act((u) => {
    if (!getSettings().allowCustomThemes) throw new UserError("Custom themes are switched off.");
    const tid = saveTheme(u.id, id, name, cleanTheme(data), shared);
    if (use) db().prepare("update users set theme_json = json_set(coalesce(theme_json, '{}'), '$.custom', ?) where id = ?").run(tid, u.id);
    revalidatePath("/", "layout");
    return tid;
  });
}

export async function deleteThemeAction(id: number) {
  return act((u) => {
    const r = db().prepare("delete from themes where id = ? and (user_id = ? or ? = 1)").run(id, u.id, u.isAdmin ? 1 : 0);
    if (!r.changes) throw new UserError("You can only delete your own themes.");
    // anyone using it goes back to their scheme
    for (const r of db().prepare("select id, theme_json from users where theme_json like ?").all(`%"custom":${id}%`) as { id: number; theme_json: string }[]) {
      try {
        const t = JSON.parse(r.theme_json);
        if (t.custom === id) db().prepare("update users set theme_json = ? where id = ?").run(JSON.stringify({ ...t, custom: null }), r.id);
      } catch {
        /* leave it */
      }
    }
    revalidatePath("/", "layout");
    return true;
  });
}

export async function resetCalendarFeedAction() {
  return act((u) => resetFeedToken(u.id));
}
