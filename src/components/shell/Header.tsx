"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useApp, useT } from "@/components/app/AppProvider";
import { isActive, isBare, visibleSections } from "./nav";
import { Drawer } from "./Drawer";
import { UserMenu } from "./UserMenu";
import { NotificationBell } from "./NotificationBell";

export function Brand({ name }: { name: string }) {
  const t = useT();
  return (
    <Link href="/" className="brand" aria-label={t("{name} home", { name })}>
      <span className="brand-mark" aria-hidden>
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="brand-text">
        <span className="brand-top">{t("A place for friends")}</span>
        <span className="brand-name">{name}</span>
      </span>
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  if (isBare(pathname)) return null;
  return <SiteHeader pathname={pathname} />;
}

function SiteHeader({ pathname }: { pathname: string }) {
  const { me, site, counts, openSearch } = useApp();
  const t = useT();
  const ref = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [drawer, setDrawer] = useState(false);
  const sections = visibleSections(site.features);
  const activeIdx = sections.findIndex((s) => isActive(s, pathname));
  useEffect(() => setDrawer(false), [pathname]);

  // the header's height, for things that stick under it
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Q and E: the section before and after this one (through the links, so the wipe plays)
  const step = (dir: -1 | 1) => {
    const links = navRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-section]");
    if (!links?.length) return;
    const n = links.length;
    const to = activeIdx < 0 ? (dir > 0 ? 0 : n - 1) : (activeIdx + dir + n) % n;
    links[to].click();
  };
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.defaultPrevented) return;
      const key = e.key.toLowerCase();
      if (key !== "q" && key !== "e") return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector("[aria-modal]")) return;
      if (!navRef.current || getComputedStyle(navRef.current).display === "none") return;
      e.preventDefault();
      stepRef.current(key === "q" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="site-header" ref={ref}>
      <div className="hd-left">
        {me ? (
          <button type="button" className="icon-btn burger" aria-label={t("Menu")} aria-expanded={drawer} onClick={() => setDrawer(true)}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {counts.chat ? <span className="count-badge" style={{ minWidth: 10, height: 10, padding: 0, top: 4, right: 4 }} /> : null}
          </button>
        ) : null}
        <Brand name={site.name} />
      </div>

      {me ? (
        <nav className="hd-nav" aria-label={t("Sections")} ref={navRef}>
          <button type="button" className="nav-key" onClick={() => step(-1)} title={t("Previous section (Q)")} aria-label={t("Previous section (Q)")} aria-keyshortcuts="Q">
            Q
          </button>
          {sections.map((s, i) => {
            const Icon = s.icon;
            const dot = s.href === "/chat" && counts.chat > 0;
            return (
              <Link key={s.href} href={s.href} data-section className={`tab ${i === activeIdx ? "active" : ""}`} aria-current={i === activeIdx ? "page" : undefined} title={t(s.label)}>
                <Icon size={18} aria-hidden />
                <span className="tab-label">{t(s.label)}</span>
                {dot ? <span className="tab-dot" title={t("New messages")} /> : null}
              </Link>
            );
          })}
          <button type="button" className="nav-key" onClick={() => step(1)} title={t("Next section (E)")} aria-label={t("Next section (E)")} aria-keyshortcuts="E">
            E
          </button>
        </nav>
      ) : (
        <span />
      )}

      <div className="hd-right">
        {me ? (
          <>
            <button type="button" className="search-btn" onClick={() => openSearch()} aria-label={t("Search")}>
              <Search size={17} />
              <span className="search-label">{t("Search everything")}</span>
              <span className="kbd hint-only">/</span>
            </button>
            <NotificationBell />
            <UserMenu />
          </>
        ) : pathname !== "/login" ? (
          <Link href="/login" className="btn btn-primary btn-sm">
            {t("Log in")}
          </Link>
        ) : null}
      </div>
      {drawer ? <Drawer onClose={() => setDrawer(false)} /> : null}
    </header>
  );
}
