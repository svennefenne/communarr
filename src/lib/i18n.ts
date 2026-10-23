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

const made = new Map<Lang, T>();

export function makeT(lang: Lang): T {
  let t = made.get(lang);
  if (t) return t;
  const d = DICTS[lang];
  const missing = new Set<string>();
  const fn = ((text: string, vars?: Vars) => {
    const hit = d?.[text];
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
  made.set(lang, fn);
  t = fn;
  return t;
}

/** In the browser: the page's language, set by AppProvider, for helpers outside components. */
let clientLang: Lang = "en";
export function setClientLang(lang: Lang) {
  clientLang = lang;
}
export const clientT = () => makeT(clientLang);
