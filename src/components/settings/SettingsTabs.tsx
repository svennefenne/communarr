"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, KeyRound, MonitorSmartphone, Palette, UserRound } from "lucide-react";

const TABS = [
  ["/settings", "Profile", UserRound],
  ["/settings/account", "Account", KeyRound],
  ["/settings/notifications", "Notifications", Bell],
  ["/settings/theme", "Theme", Palette],
  ["/settings/display", "Display", MonitorSmartphone],
] as const;

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav className="tabs">
      {TABS.map(([href, label, Icon]) => (
        <Link key={href} href={href} className={pathname === href || (href !== "/settings" && pathname.startsWith(href)) ? "active" : ""}>
          <Icon size={15} /> {label}
        </Link>
      ))}
    </nav>
  );
}
