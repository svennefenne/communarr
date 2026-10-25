"use server";

import { act } from "@/lib/act";
import { addEmoji, deleteEmoji, renameEmoji } from "@/lib/emojis";

/** The site's own emoji: each answers with the new list (everyone else gets it live). */
export async function addEmojiAction(name: string, url: string) {
  return act((u) => addEmoji(u, String(name ?? ""), String(url ?? "")));
}

export async function renameEmojiAction(name: string, next: string) {
  return act((u) => renameEmoji(u, String(name ?? ""), String(next ?? "")));
}

export async function deleteEmojiAction(name: string) {
  return act((u) => deleteEmoji(u, String(name ?? "")));
}
