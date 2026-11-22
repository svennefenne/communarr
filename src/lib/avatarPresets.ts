import "server-only";
import { db, now, tx } from "./db";
import { UserError } from "./errors";
import type { User } from "./users";

/**
 * Avatars to choose from: pictures an admin puts up (Admin → Avatars), any shape, made square when
 * they're uploaded and shown round like every profile picture. A member picks one in Settings →
 * Profile instead of (or before) a picture of their own; the picture is shared, so taking one away
 * here leaves it on the profiles that have it.
 */

export interface AvatarPreset {
  id: number;
  url: string;
}

/** at most, so the chooser stays a chooser */
const MAX = 500;
const isAvatar = (s: unknown): s is string => typeof s === "string" && /^\/media\/avatar\/[\w./-]+\.webp$/.test(s);

export function avatarPresets(): AvatarPreset[] {
  return db().prepare("select id, url from avatar_presets order by id").all() as AvatarPreset[];
}

/** Put up avatars (an admin's, uploaded as avatars): the new ones, in the order given. */
export function addAvatarPresets(u: User, urls: string[]): AvatarPreset[] {
  if (!u.isAdmin) throw new UserError("Only admins can do that.");
  const fresh = [...new Set(urls.filter(isAvatar))];
  const have = (db().prepare("select count(*) n from avatar_presets").get() as { n: number }).n;
  if (have + fresh.length > MAX) throw new UserError("That's more than {n} avatars: take some away first.", { n: MAX });
  tx(() => {
    const add = db().prepare("insert or ignore into avatar_presets (url, created_by, created_at) values (?, ?, ?)");
    for (const url of fresh) add.run(url, u.id, now());
  });
  return avatarPresets();
}

export function removeAvatarPreset(u: User, id: number): AvatarPreset[] {
  if (!u.isAdmin) throw new UserError("Only admins can do that.");
  db().prepare("delete from avatar_presets where id = ?").run(id);
  return avatarPresets();
}
