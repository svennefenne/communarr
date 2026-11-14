"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Info, Megaphone, PartyPopper, TriangleAlert, X } from "lucide-react";
import { useApp, useT } from "@/components/app/AppProvider";
import { isBare } from "./nav";

const KEY = "hd.announce";
/** (said when one's closed: the other place it shows closes too) */
const CLOSED = "hd-announce-closed";

/**
 * The admin's announcement under the header (Admin → Look). Each one can be closed once. On the front
 * page, on a wide screen, it's in the middle column instead, as wide as the feed (inPage: that one).
 */
export function Announcement({ inPage = false }: { inPage?: boolean }) {
  const { site, me } = useApp();
  const t = useT();
  const pathname = usePathname();
  const a = site.announcement;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    if (!a) return;
    const check = () => {
      try {
        setHidden(localStorage.getItem(KEY) === String(a.id));
      } catch {
        setHidden(false);
      }
    };
    check();
    window.addEventListener(CLOSED, check);
    return () => window.removeEventListener(CLOSED, check);
  }, [a]);
  if (!a || !me || hidden || isBare(pathname) || pathname.startsWith("/chat")) return null;
  const Icon = a.style === "warn" ? TriangleAlert : a.style === "party" ? PartyPopper : a.text.length > 80 ? Megaphone : Info;
  return (
    <div className={`announce-wrap ${inPage ? "in-page" : pathname === "/" ? "home-top" : ""}`}>
      <div className={`announce ${a.style}`} role="status">
        <Icon size={18} style={{ flex: "none", color: "var(--accent-2)" }} />
        <div className="grow">
          <p>{a.text}</p>
        </div>
        <button
          type="button"
          className="icon-btn xs"
          aria-label={t("Hide")}
          onClick={() => {
            setHidden(true);
            try {
              localStorage.setItem(KEY, String(a.id));
            } catch {
              /* private mode */
            }
            window.dispatchEvent(new Event(CLOSED));
          }}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
