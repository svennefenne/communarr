import "server-only";
import { headers } from "next/headers";

/** The site's address as the browser sees it (for links that leave the site: invites, calendar feeds). */
export async function baseUrl(): Promise<string> {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = (h.get("x-forwarded-proto") || "http").split(",")[0].trim();
  return `${proto}://${host}`;
}
