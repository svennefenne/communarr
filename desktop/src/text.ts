/**
 * The app's own words (its tray, its pages, its menus and messages), in Swedish or English: the site's
 * language once a page of it has been seen, else the computer's. Written in English, like the site's.
 */

export type Lang = "sv" | "en";

const SV: Record<string, string> = {
  "Open {name}": "Öppna {name}",
  "Start when I log in": "Starta när jag loggar in",
  "Change server…": "Byt server…",
  "Quit {name}": "Avsluta {name}",
  "{name} is still running in the tray. Quit it from the tray's menu.": "{name} körs vidare i systemfältet. Avsluta från menyn där.",
  "{name} is still running in the menu bar. Quit it from there.": "{name} körs vidare i menyraden. Avsluta därifrån.",
  "{n} unread": "{n} olästa",

  // the server's address (connect.html)
  "Connect to a server": "Anslut till en server",
  "The server's address": "Serverns adress",
  "example.com": "exempel.se",
  "It's the address you open the site at in a browser.": "Det är adressen du öppnar sajten med i en webbläsare.",
  Connect: "Anslut",
  "Connecting…": "Ansluter…",
  "Write the server's address.": "Skriv serverns adress.",
  "The address must start with https:// (http:// only for this computer).": "Adressen måste börja med https:// (http:// bara för den här datorn).",
  "{address} couldn't be reached: {error}": "Det gick inte att nå {address}: {error}",
  "{address} isn't a Communarr server.": "{address} är ingen Communarr-server.",
  Cancel: "Avbryt",

  // the server can't be reached (offline.html)
  "{server} can't be reached": "Det går inte att nå {server}",
  "Try again": "Försök igen",
  "Trying again in {n} s…": "Försöker igen om {n} s…",
  "Change server": "Byt server",

  // sharing the screen (picker.html)
  "Share your screen": "Dela skärmen",
  Screens: "Skärmar",
  Windows: "Fönster",
  "Screen {n}": "Skärm {n}",
  "Entire screen": "Hela skärmen",
  "No windows to share.": "Inga fönster att dela.",
  "Include the computer's sound": "Ta med datorns ljud",
  "All the computer's sound goes along, the call's voices too: use headphones, or others in the call hear themselves.":
    "Allt ljud från datorn följer med, även rösterna i samtalet. Använd hörlurar, annars hör de andra sig själva.",
  Share: "Dela",

  // the page's right-click menu
  Undo: "Ångra",
  Redo: "Gör om",
  Cut: "Klipp ut",
  Copy: "Kopiera",
  Paste: "Klistra in",
  "Select all": "Markera allt",
  "Add to the dictionary": "Lägg till i ordlistan",
  "Open the link in the browser": "Öppna länken i webbläsaren",
  "Copy the link's address": "Kopiera länkens adress",
  "Copy the image": "Kopiera bilden",
  "Save the image as…": "Spara bilden som…",
  "Copy the image's address": "Kopiera bildens adress",

  // updating itself
  "Downloading {name} {version}…": "Laddar ner {name} {version}…",
  "{name} will start again when it's in place.": "{name} startar om när den är på plats.",
  "The update couldn't be downloaded: {error}": "Uppdateringen kunde inte laddas ner: {error}",
  "The download isn't the right file.": "Filen som laddades ner stämmer inte.",
  "This copy of {name} can't replace itself where it is, so the new version opens in the browser: install it over this one.":
    "Den här kopian av {name} kan inte byta ut sig själv där den ligger, så den nya versionen öppnas i webbläsaren. Installera den över den här.",

  // a Mac's menus
  "About {name}": "Om {name}",
  "Hide {name}": "Göm {name}",
  "Hide others": "Göm övriga",
  "Show all": "Visa alla",
  Edit: "Redigera",
  View: "Visa",
  Window: "Fönster",
  Reload: "Läs in igen",
  "Actual size": "Verklig storlek",
  "Zoom in": "Zooma in",
  "Zoom out": "Zooma ut",
  "Full screen": "Helskärm",
  Minimize: "Minimera",
  Close: "Stäng",
  "Developer tools": "Utvecklarverktyg",
};

let lang: Lang = "en";

export function setLang(l: string | null | undefined): boolean {
  const next: Lang = l?.toLowerCase().startsWith("sv") ? "sv" : "en";
  const changed = next !== lang;
  lang = next;
  return changed;
}

export const getLang = () => lang;

/** A text in the app's language, its {placeholders} filled in. */
export function t(text: string, vars: Record<string, string | number> = {}): string {
  const s = lang === "sv" ? (SV[text] ?? text) : text;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Several texts at once, for one of the app's own pages. */
export function texts(keys: string[], vars: Record<string, string | number> = {}): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, t(k, vars)]));
}
