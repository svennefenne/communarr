import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "sharp", "web-push", "sanitize-html"],
  images: { unoptimized: true },
  poweredByHeader: false,
  agentRules: false,
  // room for a picture sent through a server action (uploads themselves go through /api/upload)
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  async headers() {
    return [
      // the service worker must never be cached, or phones keep an old one for a day
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
      { source: "/icons/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] },
    ];
  },
};

export default nextConfig;
