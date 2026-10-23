"use client";

import { useTransition } from "react";
import { LANGS, type Lang } from "@/lib/i18n";
import { setLanguageAction } from "@/app/actions/language";
import { useT } from "./AppProvider";

/**
 * Svenska | English for whoever is looking: kept on their account (and in a cookie for the log-in
 * page). The whole page reloads so every menu, page and date switches at once.
 */
/** The row in Settings → Display: your own language, or whatever the site uses. */
export function LanguageSetting({ own, site }: { own: Lang | null; site: Lang }) {
  const t = useT();
  const [pending, start] = useTransition();
  const siteName = LANGS.find((l) => l.id === site)?.name ?? site;
  const change = (v: string) =>
    start(async () => {
      await setLanguageAction(v as Lang | "site");
      window.location.reload();
    });
  return (
    <div className="setting-row">
      <div className="grow">
        <b>{t("Language")}</b>
        <span className="small muted">{t("Menus, pages, notifications and dates. Only for you.")}</span>
      </div>
      <select className="select" value={own ?? "site"} disabled={pending} onChange={(e) => change(e.target.value)} aria-label={t("Language")} style={{ maxWidth: 240 }}>
        <option value="site">{t("Same as the site ({name})", { name: siteName })}</option>
        {LANGS.map((l) => (
          <option key={l.id} value={l.id} lang={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function LanguageToggle({ short = false, className = "" }: { short?: boolean; className?: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const pick = (lang: Lang) => {
    if (lang === t.lang) return;
    start(async () => {
      await setLanguageAction(lang);
      window.location.reload();
    });
  };
  return (
    <div className={`pills ${className}`} role="group" aria-label={t("Language")}>
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          lang={l.id}
          className={`pill ${l.id === t.lang ? "active" : ""}`}
          aria-pressed={l.id === t.lang}
          title={short ? l.name : undefined}
          disabled={pending}
          onClick={() => pick(l.id)}
        >
          {short ? l.id.toUpperCase() : l.name}
        </button>
      ))}
    </div>
  );
}
