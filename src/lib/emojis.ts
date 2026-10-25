import "server-only";
import path from "node:path";
import sharp from "sharp";
import { db, now, tx, UPLOAD_DIR } from "./db";
import { UserError } from "./errors";
import { getSettings } from "./settings";
import { audit } from "./auth";
import { broadcast } from "./hub";
import type { User } from "./users";
import type { CustomEmoji } from "./types";

/**
 * The site's own emoji, Discord style: members add a small picture with a name and write it as
 * :name:. In what people write it's the picture (<img data-emoji>, so it stays even if the emoji
 * goes); as a reaction it's ":name:" and goes with the emoji.
 */

export const EMOJI_NAME = /^[a-z0-9_]{2,32}$/;
const MAX = 500;

/** "Party Parrot!" → "party_parrot" */
export function emojiName(s: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/^:+|:+$/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function listEmojis(): CustomEmoji[] {
  const rows = db()
    .prepare("select e.name, e.url, e.animated, e.user_id byId, u.display_name byName from emojis e left join users u on u.id = e.user_id order by e.name")
    .all() as { name: string; url: string; animated: number; byId: number | null; byName: string | null }[];
  return rows.map((r) => ({ name: r.name, url: r.url, animated: !!r.animated, by: r.byId, byName: r.byName }));
}

export function emojiExists(name: string): boolean {
  return !!db().prepare("select 1 from emojis where name = ?").get(name);
}

export function canAddEmoji(u: User): boolean {
  return getSettings().canCreate.emojis === "members" || u.isMod;
}

/** everyone sees the new list at once */
function changed(): CustomEmoji[] {
  const list = listEmojis();
  broadcast("emojis", list);
  return list;
}

function checkName(name: string, except?: string) {
  if (!EMOJI_NAME.test(name)) throw new UserError("A name is 2 to 32 letters (a–z), digits or _.");
  const other = db().prepare("select name from emojis where name = ?").get(name) as { name: string } | undefined;
  if (other && other.name !== except) throw new UserError("There's already an emoji called :{name}:.", { name });
}

/** Add one: its name, and a picture they uploaded for it (kind "emoji"). */
export async function addEmoji(u: User, rawName: string, url: string): Promise<CustomEmoji[]> {
  if (!canAddEmoji(u)) throw new UserError("Only moderators can add emoji.");
  const name = emojiName(rawName);
  checkName(name);
  if ((db().prepare("select count(*) n from emojis").get() as { n: number }).n >= MAX) throw new UserError("This site has {n} emoji already. Delete some first.", { n: MAX });
  const id = /^\/media\/emoji\/[\w/-]+\/([\w-]+)\.webp$/.exec(String(url ?? ""))?.[1];
  const up = id ? (db().prepare("select path from uploads where id = ? and user_id = ? and kind = 'emoji'").get(id, u.id) as { path: string } | undefined) : undefined;
  if (!up) throw new UserError("Pick a picture for it first.");
  const meta = await sharp(path.join(UPLOAD_DIR, up.path), { animated: true }).metadata();
  db().prepare("insert into emojis (name, url, animated, user_id, created_at) values (?, ?, ?, ?, ?)").run(name, url, (meta.pages ?? 1) > 1 ? 1 : 0, u.id, now());
  return changed();
}

/** Their own (or any, for moderators). */
function own(u: User, name: string): { name: string; user_id: number | null } {
  const e = db().prepare("select name, user_id from emojis where name = ?").get(emojiName(name)) as { name: string; user_id: number | null } | undefined;
  if (!e) throw new UserError("That emoji is gone.");
  if (e.user_id !== u.id && !u.isMod) throw new UserError("Only the one who added it, or a moderator, can do that.");
  return e;
}

/** A new name: reactions with it follow (what people wrote keeps the picture either way). */
export function renameEmoji(u: User, name: string, rawNew: string): CustomEmoji[] {
  const e = own(u, name);
  const next = emojiName(rawNew);
  if (next === e.name) return listEmojis();
  checkName(next, e.name);
  tx(() => {
    db().prepare("update emojis set name = ? where name = ?").run(next, e.name);
    db().prepare("update reactions set emoji = ? where emoji = ?").run(`:${next}:`, `:${e.name}:`);
  });
  if (e.user_id !== u.id) audit(u.id, "emoji renamed", `:${e.name}:`, `:${next}:`);
  return changed();
}

/** Gone from the picker and from reactions; where someone wrote it, its picture stays. */
export function deleteEmoji(u: User, name: string): CustomEmoji[] {
  const e = own(u, name);
  tx(() => {
    db().prepare("delete from emojis where name = ?").run(e.name);
    db().prepare("delete from reactions where emoji = ?").run(`:${e.name}:`);
  });
  if (e.user_id !== u.id) audit(u.id, "emoji deleted", `:${e.name}:`);
  return changed();
}
