import sv from "@/i18n/sv";

/**
 * The site's languages. The English text in the code is the key: t("Save") looks it up in the
 * site language's dictionary (src/i18n/<lang>) and falls back to the English. {name} in a text is
 * filled in from vars, so the dictionaries can move it: t("{name} replied", { name }).
 */

export type Lang = "en" | "sv";

export const LANGS: { id: Lang; name: string }[] = [
  { id: "en", name: "English" },
  { id: "sv", name: "Svenska" },
];

export const isLang = (x: unknown): x is Lang => x === "en" || x === "sv";

const DICTS: Record<Lang, Record<string, string> | null> = { en: null, sv };

/** The first language in an Accept-Language header that the site speaks (else English). */
export function pickLang(accept: string | null | undefined): Lang {
  const tags = (accept || "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().toLowerCase().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? 1);
      return { lang: tag.split("-")[0], q: Number.isFinite(q) ? q : 0 };
    })
    .filter((x) => x.q > 0)
    .sort((a, b) => b.q - a.q);
  return tags.map((x) => x.lang).find(isLang) ?? "en";
}

export type Vars = Record<string, string | number>;

export interface T {
  (text: string, vars?: Vars): string;
  /** one or other by n (both languages here use "1" vs the rest), with {n} filled in */
  n: (n: number, one: string, other: string, vars?: Vars) => string;
  lang: Lang;
  /** for toLocaleDateString and friends (undefined: the browser's own) */
  locale: string | undefined;
}

const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s);

/** An admin's own wording (Admin → Texts) for one language: English text → their text. */
export type Own = Record<string, string>;

// one t per language and wording, so components and effects see the same function each time
const made = new Map<string, T>();

export function makeT(lang: Lang, own?: Own): T {
  const key = own && Object.keys(own).length ? `${lang}:${JSON.stringify(own)}` : lang;
  let t = made.get(key);
  if (t) return t;
  if (made.size > 50) made.clear();
  const d = DICTS[lang];
  const missing = new Set<string>();
  const fn = ((text: string, vars?: Vars) => {
    const hit = own?.[text] ?? d?.[text];
    // while developing: say once which texts this language doesn't have yet
    if (d && hit === undefined && process.env.NODE_ENV === "development" && !missing.has(text) && /[A-Za-z]/.test(text.replace(/\{\w+\}/g, ""))) {
      missing.add(text);
      console.warn(`[i18n] no ${lang} for ${JSON.stringify(text)}`);
    }
    return fill(hit ?? text, vars);
  }) as T;
  fn.n = (n, one, other, vars) => fn(n === 1 ? one : other, { n, ...vars });
  fn.lang = lang;
  fn.locale = lang === "sv" ? "sv-SE" : undefined;
  made.set(key, fn);
  t = fn;
  return t;
}

/** The built-in text for a key in a language (what Admin → Texts shows as the default). */
export const builtIn = (lang: Lang, text: string) => DICTS[lang]?.[text] ?? text;

/** Every built-in text the site knows (the English keys of the dictionaries). */
export const allTexts = () => Object.keys(DICTS.sv ?? {});

/** In the browser: the page's language and wording, set by AppProvider, for helpers outside components. */
let clientLang: Lang = "en";
let clientOwn: Own | undefined;
export function setClientLang(lang: Lang, own?: Own) {
  clientLang = lang;
  clientOwn = own;
}
export const clientT = () => makeT(clientLang, clientOwn);
