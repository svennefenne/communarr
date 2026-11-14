/**
 * The order of the people the @ list offers. The places someone writes in ("tiers": the chat, the
 * group, the conversation they're in, the innermost first) bring their people to the top, then whoever
 * is online, then everyone else. Typing narrows it: names that start with it first, then the same order.
 */

export interface MentionTier {
  ids: number[];
  /** what its heading in the list says (English, translated there): "In the chat" */
  label: string;
}

export interface MentionSection<T> {
  /** null: no heading (a narrowed list, or only everyone) */
  label: string | null;
  items: T[];
}

export function orderMentions<T extends { id: number; name: string; username: string }>(people: T[], query: string, tiers: MentionTier[], online: (id: number) => boolean, me?: number): MentionSection<T>[] {
  const list = people.filter((u) => u.id !== me);
  const tierOf = (id: number) => {
    const i = tiers.findIndex((t) => t.ids.includes(id));
    return i === -1 ? tiers.length : i;
  };
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  const onlineFirst = (a: T, b: T) => Number(!online(a.id)) - Number(!online(b.id)) || byName(a, b);
  const q = query.trim().toLowerCase();
  if (q) {
    const starts = (u: T) => u.username.toLowerCase().startsWith(q) || u.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q));
    return [{ label: null, items: [...list].sort((a, b) => Number(!starts(a)) - Number(!starts(b)) || tierOf(a.id) - tierOf(b.id) || onlineFirst(a, b)) }];
  }
  const sections: MentionSection<T>[] = tiers.map((t) => ({ label: t.label, items: [] }));
  const now: MentionSection<T> = { label: "Online", items: [] };
  const rest: MentionSection<T> = { label: "Everyone else", items: [] };
  for (const u of list) {
    const i = tierOf(u.id);
    (i < tiers.length ? sections[i] : online(u.id) ? now : rest).items.push(u);
  }
  for (const s of sections) s.items.sort(onlineFirst);
  now.items.sort(byName);
  rest.items.sort(byName);
  const out = [...sections, now, rest].filter((s) => s.items.length);
  // (just everyone: nothing to tell apart)
  if (out.length === 1 && out[0] === rest) rest.label = null;
  return out;
}
