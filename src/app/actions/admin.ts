"use server";

import { revalidatePath } from "next/cache";
import { act } from "@/lib/act";
import { UserError } from "@/lib/errors";
import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULTS, getSettings, setSettings, type SiteSettings } from "@/lib/settings";
import { addMember, approve, ban, deleteMember, logoutEverywhere, reindexAll, resetLink, setPasswordFor, setRole, suspend, vacuum } from "@/lib/admin";
import { createInvite } from "@/lib/accounts";
import { resolveReport } from "@/lib/reports";
import { cleanOrphans } from "@/lib/uploads";
import { deleteCategory, moveCategory, saveCategory } from "@/lib/forum";
import { deleteGroup } from "@/lib/groups";
import { archiveRoom, deleteRoom } from "@/lib/chat";
import { pushTo, rotateVapid } from "@/lib/push";
import { broadcast } from "@/lib/hub";
import { cleanLine } from "@/lib/sanitize";
import { PALETTE_BY_SLUG } from "@/lib/palettes";
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
    if (clean.siteName !== undefined) clean.siteName = cleanLine(clean.siteName, 40) || s.siteName;
    if (clean.tagline !== undefined) clean.tagline = cleanLine(clean.tagline, 200);
    if (clean.welcome !== undefined) clean.welcome = cleanLine(clean.welcome, 400);
    if (clean.footer !== undefined) clean.footer = cleanLine(clean.footer, 120);
    if (clean.defaultScheme !== undefined && !PALETTE_BY_SLUG.has(clean.defaultScheme)) delete clean.defaultScheme;
    if (clean.registration !== undefined && !["invite", "open", "closed"].includes(clean.registration)) delete clean.registration;
    if (clean.defaultMode !== undefined && !["dark", "light", "system"].includes(clean.defaultMode)) delete clean.defaultMode;
    if (clean.backdrop !== undefined && !["orbits", "stars", "grid", "waves", "plain"].includes(clean.backdrop)) delete clean.backdrop;
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
  return act(async (u) => pushTo(u.id, { title: "Test from the admin page", body: "Push notifications work.", url: "/admin#notifications", tag: "test" }));
}
export async function rotateVapidAction() {
  return act((u) => {
    admin(u);
    rotateVapid();
    audit(u.id, "new push keys");
    return true;
  });
}
