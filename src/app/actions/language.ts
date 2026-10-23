"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getUser, hasAnyUser } from "@/lib/auth";
import { setSettings } from "@/lib/settings";
import { isLang, type Lang } from "@/lib/i18n";
import { setLangCookie } from "@/lib/t";

/**
 * Someone's own language: "site" goes back to following the site's. Members keep it on their
 * account; everyone (also on the log-in page) gets it in a cookie.
 */
export async function setLanguageAction(lang: Lang | "site") {
  const own = isLang(lang) ? lang : null;
  if (lang !== "site" && !own) return;
  const u = await getUser();
  if (u) db().prepare("update users set lang = ? where id = ?").run(own, u.id);
  await setLangCookie(own);
  revalidatePath("/", "layout");
}

/** The setup page's switch: the site's language (only before there's anyone). */
export async function setupLanguageAction(fd: FormData) {
  if (hasAnyUser()) redirect("/login");
  const lang = String(fd.get("lang") ?? "");
  if (isLang(lang)) {
    setSettings({ language: lang });
    await setLangCookie(lang);
  }
  redirect("/setup");
}
