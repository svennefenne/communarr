import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "./db";
import { getSetting } from "./settings";
import { getUser } from "./auth";
import { isLang, makeT, type Lang, type T } from "./i18n";

/**
 * Which language text on the server is in:
 * - requestT(): the person viewing (their own choice, else the language cookie from the log-in page,
 *   else the site's). Pages, metadata, actions and routes.
 * - userT(id): one known person (notifications, their calendar feed).
 * - serverT(): the site's, for text stored once and shown to everyone (chat system messages,
 *   what a new site starts with).
 */

/** Set by the language switch, so the log-in page keeps someone's choice. */
export const LANG_COOKIE = "hooden_lang";

/** Remember a language for this browser (the log-in page uses it); null forgets it. */
export async function setLangCookie(lang: Lang | null) {
  const jar = await cookies();
  if (lang) jar.set(LANG_COOKIE, lang, { path: "/", maxAge: 365 * 86_400, sameSite: "lax", httpOnly: true });
  else jar.delete(LANG_COOKIE);
}

/** A member's own language, or null when they follow the site's. */
export function memberLang(userId: number): Lang | null {
  const r = db().prepare("select lang from users where id = ?").get(userId) as { lang: string | null } | undefined;
  return isLang(r?.lang) ? r.lang : null;
}

export function serverT(): T {
  return makeT(getSetting("language"));
}

export function userT(userId: number): T {
  return makeT(memberLang(userId) ?? getSetting("language"));
}

/** The language of whoever this request is for (once per request). */
export const requestLang = cache(async (): Promise<Lang> => {
  const u = await getUser();
  const own = u ? memberLang(u.id) : null;
  if (own) return own;
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(c) ? c : getSetting("language");
});

export async function requestT(): Promise<T> {
  return makeT(await requestLang());
}
