"use server";

import { revalidatePath } from "next/cache";
import { act } from "@/lib/act";
import { UserError } from "@/lib/errors";
import { userT } from "@/lib/t";
import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULTS, dropDefaultTexts, getSettings, setSettings, type SiteSettings } from "@/lib/settings";
import { allTexts, builtIn, isLang, LANGS, type Lang } from "@/lib/i18n";
import { placesFor } from "@/lib/textPlaces";
import { cleanSounds } from "@/lib/sounds";
import PLACES from "@/i18n/places.json";
import { addMember, approve, ban, deleteMember, logoutEverywhere, reindexAll, resetLink, setPasswordFor, setRole, suspend, vacuum } from "@/lib/admin";
import { createInvite } from "@/lib/accounts";
import { resolveReport } from "@/lib/reports";
import { deleteFeedback, markFeedback } from "@/lib/feedback";
import { cleanOrphans } from "@/lib/uploads";
import { deleteCategory, moveCategory, saveCategory } from "@/lib/forum";
import { deleteGroup } from "@/lib/groups";
import { archiveRoom, deleteRoom } from "@/lib/chat";
import { pushTo, rotateVapid } from "@/lib/push";
import { broadcast } from "@/lib/hub";
import { cleanLine } from "@/lib/sanitize";
import { mailReady, normEmail, saveMailSettings, sendMail, validEmail, type MailSecurity } from "@/lib/mail";
import { testMail } from "@/lib/mailTemplates";
import { mailResetLink, rememberOrigin } from "@/lib/accountMail";
import { baseUrl } from "@/lib/url";
import { PALETTE_BY_SLUG } from "@/lib/palettes";
import { isBackdrop, type LibraryBackdrop } from "@/lib/theme";
import type { User } from "@/lib/users";
import type { Role } from "@/lib/types";

function admin(u: User) {
  if (!u.isAdmin) throw new UserError("Only admins can do that.");
}
function mod(u: User) {
  if (!u.isMod) throw new UserError("Only moderators and admins can do that.");
}

// ── members ──

export async function setRoleAction(id: number, role: Role) {
  return act((u) => setRole(u, id, role));
}
export async function suspendAction(id: number, days: number | null) {
  return act((u) => {
    mod(u);
    suspend(u, id, days);
    return true;
  });
}
export async function banAction(id: number, banned: boolean, reason: string) {
  return act((u) => {
    ban(u, id, banned, reason);
    return true;
  });
}
export async function approveAction(id: number, yes: boolean) {
  return act((u) => {
    mod(u);
    approve(u, id, yes);
    return true;
  });
}
export async function resetLinkAction(id: number) {
  return act((u) => resetLink(u, id));
}
export async function logoutEverywhereAction(id: number) {
  return act((u) => {
    mod(u);
    logoutEverywhere(u, id);
    return true;
  });
}
export async function deleteMemberAction(id: number) {
  return act((u) => {
    deleteMember(u, id);
    return true;
  });
}
export async function addMemberAction(username: string, name: string, role: Role) {
  return act((u) => addMember(u, { username: username.trim(), name: name.trim() || username.trim(), role }));
}
export async function setPasswordAction(id: number, pw: string) {
  return act(async (u) => {
    await setPasswordFor(u, id, pw);
    return true;
  });
}

// ── invites ──

export async function createInviteAction(o: { note?: string; maxUses?: number | null; days?: number | null; role?: Role; groupId?: number | null }) {
  return act((u) => {
    admin(u);
    const code = createInvite(u.id, { ...o, role: o.role === "moderator" ? "moderator" : "member" });
    audit(u.id, "invite", code, o.note ?? "");
    return code;
  });
}
export async function revokeInviteAction(code: string) {
  return act((u) => {
    admin(u);
    db().prepare("update invites set revoked = 1 where code = ?").run(code);
    audit(u.id, "revoke invite", code);
    return true;
  });
}

// ── reports ──

export async function resolveReportAction(id: number, status: "resolved" | "dismissed", note: string) {
  return act((u) => {
    mod(u);
    resolveReport(u, id, status, note);
    return true;
  });
}

// ── settings ──

/** Save some of the site settings (each checked against its default's shape). */
export async function saveSettingsAction(patch: Partial<SiteSettings>) {
  return act((u) => {
    admin(u);
    const clean: Partial<SiteSettings> = {};
    const s = getSettings();
    for (const [k, v] of Object.entries(patch) as [keyof SiteSettings, unknown][]) {
      const d = DEFAULTS[k];
      if (v === undefined || typeof v !== typeof d) continue;
      if (Array.isArray(d) !== Array.isArray(v)) continue;
      (clean as Record<string, unknown>)[k] = v;
    }
    if (clean.language !== undefined && !isLang(clean.language)) delete clean.language;
    if (clean.language !== undefined && clean.language !== s.language) dropDefaultTexts();
    if (clean.timeFormat !== undefined && clean.timeFormat !== "24h" && clean.timeFormat !== "12h") delete clean.timeFormat;
    if (clean.weekStart !== undefined && ![0, 1, 6].includes(clean.weekStart)) delete clean.weekStart;
    if (clean.defaultRoom !== undefined && !(Number.isInteger(clean.defaultRoom) && clean.defaultRoom >= -1)) delete clean.defaultRoom;
    if (clean.sounds !== undefined) clean.sounds = cleanSounds(clean.sounds);
    if (clean.siteName !== undefined) clean.siteName = cleanLine(clean.siteName, 40) || s.siteName;
    if (clean.logo !== undefined && clean.logo !== "" && !/^\/media\/logo\/[\w./-]+$/.test(clean.logo)) delete clean.logo;
    if (clean.tagline !== undefined) clean.tagline = cleanLine(clean.tagline, 200);
    if (clean.welcome !== undefined) clean.welcome = cleanLine(clean.welcome, 400);
    if (clean.footer !== undefined) clean.footer = cleanLine(clean.footer, 120);
    if (clean.defaultScheme !== undefined && !PALETTE_BY_SLUG.has(clean.defaultScheme)) delete clean.defaultScheme;
    if (clean.registration !== undefined && !["invite", "open", "closed"].includes(clean.registration)) delete clean.registration;
    if (clean.defaultMode !== undefined && !["dark", "light", "system"].includes(clean.defaultMode)) delete clean.defaultMode;
    if (clean.backdrops !== undefined) {
      const media = (x: unknown) => (typeof x === "string" && /^\/media\/[\w./-]+$/.test(x) ? x : "");
      const list = (Array.isArray(clean.backdrops) ? clean.backdrops : []) as Partial<LibraryBackdrop>[];
      clean.backdrops = list
        .map((b) => ({
          id: /^[a-z0-9]{4,24}$/.test(String(b?.id)) ? String(b.id) : Math.random().toString(36).slice(2, 12),
          name: cleanLine(String(b?.name ?? ""), 40) || "Backdrop",
          desktop: media(b?.desktop),
          mobile: media(b?.mobile),
        }))
        .filter((b) => b.desktop || b.mobile)
        .slice(0, 40);
    }
    // a library backdrop must be in the library (the site's default goes back to the stars if its picture went)
    const library = clean.backdrops ?? s.backdrops;
    const inLibrary = (b: string) => !b.startsWith("pic:") || library.some((x) => `pic:${x.id}` === b);
    if (clean.backdrop !== undefined && (!isBackdrop(clean.backdrop) || !inLibrary(clean.backdrop))) delete clean.backdrop;
    if (clean.backdrops !== undefined && !inLibrary(clean.backdrop ?? s.backdrop)) clean.backdrop = "orbits";
    if (clean.glass !== undefined) clean.glass = Math.max(0, Math.min(100, Math.round(clean.glass)));
    if (clean.maxUploadMb !== undefined) clean.maxUploadMb = Math.max(1, Math.min(200, Math.round(clean.maxUploadMb)));
    if (clean.wordFilter !== undefined) clean.wordFilter = clean.wordFilter.map((w) => String(w).trim()).filter(Boolean).slice(0, 500);
    if (clean.announcement !== undefined) {
      const a = clean.announcement;
      clean.announcement = { text: cleanLine(a.text, 400), style: ["info", "warn", "party"].includes(a.style) ? a.style : "info", on: !!a.on, id: a.text !== s.announcement.text || (a.on && !s.announcement.on) ? Date.now() : s.announcement.id };
    }
    if (clean.background !== undefined) {
      const b = clean.background;
      const m = (x: unknown) => (typeof x === "string" && /^\/media\/[\w./-]+$/.test(x) ? x : "");
      clean.background = { desktop: m(b.desktop), mobile: m(b.mobile), dim: Math.max(0, Math.min(90, Number(b.dim) || 0)), blur: Math.max(0, Math.min(20, Number(b.blur) || 0)) };
    }
    if (clean.voice !== undefined) {
      clean.voice = {
        max: Math.max(2, Math.min(25, Math.round(clean.voice.max || 10))),
        ice: (clean.voice.ice || []).filter((x) => x && /^(stun|turn|turns):/.test(x.urls)).map((x) => ({ urls: x.urls.trim(), ...(x.username ? { username: x.username } : {}), ...(x.credential ? { credential: x.credential } : {}) })),
      };
    }
    if (clean.pushContact !== undefined && clean.pushContact && !/^(mailto:|https:\/\/)/.test(clean.pushContact)) throw new UserError("The push contact must start with mailto: or https://");
    setSettings(clean);
    audit(u.id, "settings", Object.keys(clean).join(", "));
    revalidatePath("/", "layout");
    // pages open right now pick up the new look and switches
    broadcast("refresh", {});
    return getSettings();
  });
}

// ── content ──

export async function saveCategoryAction(o: { id?: number; name: string; description?: string; color?: string; icon?: string; locked?: boolean; groupId?: number | null }) {
  return act((u) => saveCategory(u, o));
}
export async function moveCategoryAction(id: number, dir: -1 | 1) {
  return act((u) => {
    moveCategory(u, id, dir);
    return true;
  });
}
export async function deleteCategoryAction(id: number, moveTo?: number) {
  return act((u) => {
    deleteCategory(u, id, moveTo);
    return true;
  });
}
export async function deleteGroupAdminAction(id: number) {
  return act((u) => {
    admin(u);
    deleteGroup(u, id);
    audit(u.id, "delete group", String(id));
    return true;
  });
}
export async function deleteRoomAdminAction(id: number) {
  return act((u) => {
    admin(u);
    deleteRoom(u, id);
    audit(u.id, "delete room", String(id));
    return true;
  });
}
export async function archiveRoomAdminAction(id: number, archived: boolean) {
  return act((u) => {
    admin(u);
    archiveRoom(u, id, archived);
    return archived;
  });
}

// ── system ──

export async function cleanupAction() {
  return act((u) => {
    admin(u);
    const r = cleanOrphans();
    audit(u.id, "clean up pictures", `${r.removed} removed`);
    return r;
  });
}
export async function vacuumAction() {
  return act((u) => {
    admin(u);
    vacuum();
    return true;
  });
}
export async function reindexAction() {
  return act((u) => {
    admin(u);
    return reindexAll();
  });
}
export async function testPushAction() {
  return act(async (u) => {
    const t = userT(u.id);
    return pushTo(u.id, { title: t("Test from the admin page"), body: t("Push notifications work."), url: "/admin#notifications", tag: "test" });
  });
}
export async function rotateVapidAction() {
  return act((u) => {
    admin(u);
    rotateVapid();
    audit(u.id, "new push keys");
    return true;
  });
}

// ── texts (the site's own wording for any built-in text) ──

export interface TextRow {
  key: string;
  /** the built-in text in each language */
  builtIn: Record<Lang, string>;
  /** the admin's own, where there is one */
  own: Partial<Record<Lang, string>>;
  /** where it shows up (English place names, src/lib/textPlaces.ts) */
  places: string[];
}

/** The places a text shows up in (from src/i18n/places.json). */
const placesOf = (key: string) => placesFor(key, (PLACES as Record<string, string[]>)[key] ?? []);

/**
 * Built-in texts matching a search (in any language, or the admin's own wording), every changed one,
 * or every one on a page (`place`).
 */
export async function searchTextsAction(q: string, changedOnly: boolean, place = "") {
  return act((u): TextRow[] => {
    admin(u);
    const texts = getSettings().texts;
    const needle = q.trim().toLowerCase();
    const changed = new Set(LANGS.flatMap((l) => Object.keys(texts[l.id] ?? {})));
    const rows: TextRow[] = [];
    for (const key of allTexts()) {
      // the starter post's HTML is only used once, at setup
      if (key.startsWith("<")) continue;
      if (changedOnly && !changed.has(key)) continue;
      const places = placesOf(key);
      if (place && !places.includes(place)) continue;
      const row: TextRow = {
        key,
        builtIn: Object.fromEntries(LANGS.map((l) => [l.id, builtIn(l.id, key)])) as Record<Lang, string>,
        own: Object.fromEntries(LANGS.filter((l) => texts[l.id]?.[key] !== undefined).map((l) => [l.id, texts[l.id]![key]])),
        places,
      };
      if (needle && ![key, ...Object.values(row.builtIn), ...Object.values(row.own)].some((s) => s.toLowerCase().includes(needle))) continue;
      rows.push(row);
      if (rows.length >= (place ? 150 : 60)) break;
    }
    return rows;
  });
}

/** Your own wording for one text in one language; empty goes back to the built-in text. */
export async function saveTextAction(lang: Lang, key: string, value: string) {
  return act((u) => {
    admin(u);
    if (!isLang(lang) || key.startsWith("<") || !allTexts().includes(key)) throw new UserError("There's no such text.");
    const v = value.replace(/\s+/g, " ").trim().slice(0, 2000);
    const texts = { ...getSettings().texts };
    const mine = { ...(texts[lang] ?? {}) };
    if (v && v !== builtIn(lang, key)) mine[key] = v;
    else delete mine[key];
    texts[lang] = mine;
    setSettings({ texts });
    audit(u.id, "text", `${lang}: ${key.slice(0, 80)}`);
    revalidatePath("/", "layout");
    return true;
  });
}

// ── feedback (from the user menu's "Send feedback") ──

export async function feedbackDoneAction(id: number, done: boolean) {
  return act((u) => {
    admin(u);
    markFeedback(u, id, done);
    revalidatePath("/admin");
    return true;
  });
}

export async function deleteFeedbackAction(id: number) {
  return act((u) => {
    admin(u);
    deleteFeedback(id);
    audit(u.id, "delete feedback", String(id));
    revalidatePath("/admin");
    return true;
  });
}

// ───────────── mail ─────────────

export interface MailInput {
  host: string;
  port: number;
  security: MailSecurity;
  user: string;
  /** null: keep the saved password */
  pass: string | null;
  from: string;
  fromName: string;
}

/** Admin → Mail: the SMTP server (an empty server turns the saved one off). */
export async function saveMailAction(input: MailInput) {
  return act(async (u) => {
    admin(u);
    const host = input.host.trim().slice(0, 200);
    const from = normEmail(input.from);
    if (host && !validEmail(from)) throw new UserError("The sender needs a real address (the one the server sends as).");
    const security: MailSecurity = input.security === "tls" || input.security === "none" ? input.security : "starttls";
    const port = Math.round(Number(input.port));
    saveMailSettings({
      host,
      port: port > 0 && port < 65536 ? port : security === "tls" ? 465 : security === "none" ? 25 : 587,
      security,
      user: input.user.trim().slice(0, 200),
      pass: input.pass === null ? null : input.pass.slice(0, 500),
      from,
      // (a line of its own in the mail's header: no line breaks)
      fromName: input.fromName.replace(/\s+/g, " ").trim().slice(0, 60),
    });
    audit(u.id, host ? "mail settings" : "mail off", host);
    await rememberOrigin();
    revalidatePath("/admin");
    return true;
  });
}

/** Admin → Mail: send a test mail (to the address given, or your own). */
export async function testMailAction(to: string) {
  return act(async (u) => {
    admin(u);
    if (!mailReady()) throw new UserError("Set up the mail server first.");
    const addr = normEmail(to) || ((db().prepare("select email from users where id = ?").get(u.id) as { email: string | null } | undefined)?.email ?? "");
    if (!validEmail(addr)) throw new UserError("Write the address to send it to.");
    const site = getSettings().siteName;
    try {
      await sendMail(testMail(userT(u.id), { to: addr, site, origin: await baseUrl() }), site);
    } catch (e) {
      throw new UserError("It didn't go: {error}", { error: (e instanceof Error ? e.message : String(e)).slice(0, 300) });
    }
    revalidatePath("/admin");
    return addr;
  });
}

/** Admin → Members: mail someone a link for a new password (to their confirmed address). */
export async function mailResetLinkAction(id: number) {
  return act((u) => mailResetLink(u, id));
}
