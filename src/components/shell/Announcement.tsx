"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Info, Megaphone, PartyPopper, TriangleAlert, X } from "lucide-react";
import { useApp, useT } from "@/components/app/AppProvider";
import { isBare } from "./nav";

/** The admin's announcement under the header (Admin → Look). Each one can be closed once. */
export function Announcement() {
  const { site, me } = useApp();
  const t = useT();
  const pathname = usePathname();
  const a = site.announcement;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    if (!a) return;
    try {
      setHidden(localStorage.getItem("hd.announce") === String(a.id));
    } catch {
      setHidden(false);
    }
  }, [a]);
  if (!a || !me || hidden || isBare(pathname) || pathname.startsWith("/chat")) return null;
  const Icon = a.style === "warn" ? TriangleAlert : a.style === "party" ? PartyPopper : a.text.length > 80 ? Megaphone : Info;
  return (
    <div className="announce-wrap">
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
              localStorage.setItem("hd.announce", String(a.id));
            } catch {
              /* private mode */
            }
          }}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
