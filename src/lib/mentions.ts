import "server-only";
import { notify, type NotifyInput } from "./notify";
import { userByName, usersWho, type User } from "./users";

/** A mention as the editor writes it (and the sanitizer keeps it): its username in data-id. */
const MENTION = /data-type="mention"[^>]*data-id="([^"]+)"/g;

/** The usernames a text (its html, as kept) mentions. */
export function mentionsIn(html: string): string[] {
  return [...new Set([...html.matchAll(MENTION)].map((m) => m[1]))];
}

/**
 * Tell the people a text mentions that it does (the bell, a push, a mail, by their settings): the ones
 * who can see it, never the one who wrote it, and after an edit (`before`, the text it was) only the
 * ones it didn't mention already. Who was told.
 */
export function tellMentioned(
  by: User,
  names: string[],
  { before, sees, kind = "mention", ...n }: { before?: string; sees: (x: User) => boolean; kind?: NotifyInput["kind"] } & Omit<NotifyInput, "kind" | "actorId">,
): number[] {
  const was = new Set(before ? mentionsIn(before) : []);
  const ids = names.filter((name) => !was.has(name)).map((name) => userByName(name)?.id).filter((id): id is number => !!id && id !== by.id);
  const who = usersWho(ids, sees);
  if (who.length) notify(who, { ...n, kind, actorId: by.id });
  return who;
}
