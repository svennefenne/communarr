"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/components/app/AppProvider";
import { isBare } from "./nav";
import { InstallButton } from "./InstallButton";

/** The status line at the very bottom (in the frame's bottom edge when the frame is on). */
export function Footer() {
  const { me, site } = useApp();
  const pathname = usePathname();
  if (isBare(pathname)) return null;
  return (
    <footer className="site-footer">
      <span className="mono">
        {site.footer}
        {me?.isMod ? (
          <>
            {" · "}
            <Link href="/admin" style={{ textDecoration: "underline dotted" }}>
              ADMIN
            </Link>
          </>
        ) : null}
        {me ? (
          <>
            {" · "}
            <Link href="/settings/notifications" style={{ textDecoration: "underline dotted" }}>
              NOTIFICATIONS
            </Link>
          </>
        ) : null}
      </span>
      <span className="foot-tools">{me ? <InstallButton /> : null}</span>
    </footer>
  );
}
