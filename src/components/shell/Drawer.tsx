"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { useApp, useT } from "@/components/app/AppProvider";
import { ADMIN, isActive, MORE, visibleSections } from "./nav";
import { Brand } from "./Header";
import { ModeSwitch } from "./UserMenu";
import { LanguageToggle } from "@/components/app/LanguageToggle";
import { OnlinePeople, useHereNow } from "./OnlineButton";

/** The menu from the side: every section and place, and light or dark. */
export function Drawer({ onClose }: { onClose: () => void }) {
  const { me, site, counts, openSearch } = useApp();
  const t = useT();
  const here = useHereNow();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!mounted || !me) return null;
  const more = MORE.filter((s) => !s.feature || site.features[s.feature]);
  return createPortal(
    <div className="drawer-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <nav className="panel drawer" aria-label={t("Menu")} onClick={(e) => (e.target as HTMLElement).closest("a") && onClose()}>
        <div style={{ padding: "4px 8px 12px" }}>
          <Brand name={site.name} />
        </div>
        <button
          type="button"
          className="search-btn"
          style={{ width: "100%", margin: "0 0 8px", justifyContent: "flex-start" }}
          onClick={() => {
            onClose();
            openSearch();
          }}
        >
          <Search size={17} /> <span>{t("Search everything")}</span>
        </button>
        <span className="eyebrow">{t("Here now · {n}", { n: here.length })}</span>
        <div className="drawer-online">
          <OnlinePeople ids={here} onPick={onClose} />
        </div>
        {visibleSections(site.features).map((s) => {
          const Icon = s.icon;
          const n = s.href === "/chat" ? counts.chat : 0;
          return (
            <Link key={s.href} href={s.href} className={`drawer-link ${isActive(s, pathname) ? "active" : ""}`}>
              <Icon size={19} /> {t(s.label)}
              {n ? <span className="count-badge">{n}</span> : null}
            </Link>
          );
        })}
        <span className="eyebrow">{t("More")}</span>
        {more.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href} className={`drawer-link ${isActive(s, pathname) ? "active" : ""}`}>
              <Icon size={19} /> {t(s.label)}
            </Link>
          );
        })}
        {me.isMod ? (
          <Link href={ADMIN.href} className={`drawer-link ${isActive(ADMIN, pathname) ? "active" : ""}`}>
            <ADMIN.icon size={19} /> {t(ADMIN.label)}
          </Link>
        ) : null}
        <span className="eyebrow">{t("Look")}</span>
        <div style={{ padding: "0 8px" }}>
          <ModeSwitch mode={me.theme.mode} />
        </div>
        <span className="eyebrow">{t("Language")}</span>
        <div style={{ padding: "0 8px" }}>
          <LanguageToggle />
        </div>
      </nav>
    </div>,
    document.body,
  );
}
