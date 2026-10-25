import "server-only";
import { headers } from "next/headers";

/**
 * A redirect to a path on this site, without an address: the browser stays on the one it's at. (A
 * route's req.url is the server's own, e.g. https://0.0.0.0:3000 in the Docker image, not the site's.)
 */
export function redirectTo(path: string): Response {
  return new Response(null, { status: 307, headers: { Location: path } });
}

/** The site's address as the browser sees it (for links that leave the site: invites, calendar feeds). */
export async function baseUrl(): Promise<string> {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = (h.get("x-forwarded-proto") || "http").split(",")[0].trim();
  return `${proto}://${host}`;
}
