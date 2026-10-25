/**
 * A game's number from a link to its page on BoardGameGeek ("https://boardgamegeek.com/boardgame/266192/wingspan"
 * → 266192), or null. BGG turns away fetching its pages, so a game's card comes from its API instead.
 */
export function bggIdOf(url: string): number | null {
  const m = /^https?:\/\/(?:www\.)?boardgamegeek\.com\/(?:boardgame|boardgameexpansion|boardgameaccessory|boardgameimplementation|thing)\/(\d{1,9})(?:[/?#]|$)/i.exec(url);
  return m ? Number(m[1]) : null;
}
