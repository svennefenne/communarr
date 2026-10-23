import type { MetadataRoute } from "next";
import { defaultTextIn, getSettings } from "@/lib/settings";
import { palette } from "@/lib/palettes";
import { requestT } from "@/lib/t";

// the site's name and colours come from the admin's settings, so never baked in at build time
export const dynamic = "force-dynamic";

/** Installable on phones, tablets and computers (and the way to push notifications on iPhones). */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await requestT();
  const s = getSettings();
  const p = palette(s.defaultScheme);
  return {
    id: "/",
    name: s.siteName,
    short_name: s.siteName.slice(0, 12),
    description: defaultTextIn("tagline", s.tagline, t.lang),
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
      { name: t("Chat"), url: "/chat", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: t("Calendar"), url: "/calendar", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: t("Notifications"), url: "/notifications", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
