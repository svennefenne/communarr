"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { isActive, isBare, visibleSections } from "./nav";
import { Drawer } from "./Drawer";

/** Phones: the first four sections and More, in a glass bar along the bottom. */
export function BottomNav() {
  const { me, site, counts } = useApp();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setDrawer(false), [pathname]);
  if (!me || isBare(pathname)) return null;
  const shown = visibleSections(site.features).slice(0, 4);
  const moreActive = !shown.some((s) => isActive(s, pathname));
  return (
    <>
      <nav className="bottom-nav" aria-label="Sections">
        {shown.map((s) => {
          const Icon = s.icon;
          const active = isActive(s, pathname);
          const n = s.href === "/chat" ? counts.chat : 0;
          return (
            <Link key={s.href} href={s.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
              <span className="bn-icon">
                <Icon size={21} />
                {n ? <span className="count-badge">{n}</span> : null}
              </span>
              {s.label}
            </Link>
          );
        })}
        <button type="button" className={moreActive && pathname !== "/" ? "active" : ""} onClick={() => setDrawer(true)} aria-label="More">
          <span className="bn-icon">
            <Menu size={21} />
          </span>
          More
        </button>
      </nav>
      {drawer ? <Drawer onClose={() => setDrawer(false)} /> : null}
    </>
  );
}
