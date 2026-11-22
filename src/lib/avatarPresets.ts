import "server-only";
import { db, now, tx } from "./db";
import { UserError } from "./errors";
import type { User } from "./users";

/**
 * Avatars to choose from: pictures an admin puts up (Admin → Avatars), any shape, made square when
 * they're uploaded and shown round like every profile picture. A member picks one in Settings →
 * Profile instead of (or before) a picture of their own. Each is one member's at a time: one someone
 * has is shown as theirs, and can't be chosen (updateProfile checks). Taking one away here leaves it
 * on the profile that has it.
 */

export interface AvatarPreset {
  id: number;
  url: string;
  /** the member who has it as their picture (left out: the one asking) */
  holder: { id: number; name: string } | null;
}

/** at most, so the chooser stays a chooser (a page at a time) */
export const AVATAR_PRESET_MAX = 1000;
const MAX = AVATAR_PRESET_MAX;
const isAvatar = (s: unknown): s is string => typeof s === "string" && /^\/media\/avatar\/[\w./-]+\.webp$/.test(s);

/** Them all, in the order they were put up, with who has each (but `me`: theirs counts as free). */
export function avatarPresets(me = 0): AvatarPreset[] {
  const rows = db()
    .prepare(
      `select p.id, p.url, u.id holder_id, u.display_name holder_name
         from avatar_presets p
         left join users u on u.id = (select min(x.id) from users x where x.avatar = p.url and x.id != ?)
        order by p.id`,
    )
    .all(me) as { id: number; url: string; holder_id: number | null; holder_name: string | null }[];
  return rows.map((r) => ({ id: r.id, url: r.url, holder: r.holder_id ? { id: r.holder_id, name: r.holder_name ?? "" } : null }));
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
