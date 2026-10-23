import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";
import { palette } from "@/lib/palettes";

// the site's name and colours come from the admin's settings, so never baked in at build time
export const dynamic = "force-dynamic";

/** Installable on phones, tablets and computers (and the way to push notifications on iPhones). */
export default function manifest(): MetadataRoute.Manifest {
  const s = getSettings();
  const p = palette(s.defaultScheme);
  return {
    id: "/",
    name: s.siteName,
    short_name: s.siteName.slice(0, 12),
    description: s.tagline,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: p.dark.bg,
    theme_color: p.dark.bg,
    categories: ["social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Chat", url: "/chat", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Calendar", url: "/calendar", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Notifications", url: "/notifications", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
