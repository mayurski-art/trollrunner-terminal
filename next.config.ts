import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phones request /favicon.ico directly, and with no file there some kept
  // showing the old default Vercel triangle. Serve the desktop tab icon
  // (app/icon.png) at that path instead.
  // [logs] became [riddles], and Trolldeaths was removed; keep old links landing somewhere.
  async redirects() {
    return [
      { source: "/logs", destination: "/riddles", permanent: true },
      { source: "/trolldeaths/:path*", destination: "/", permanent: true },
      { source: "/trolldeaths", destination: "/", permanent: true },
    ];
  },
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon.png" }];
  },
};

export default nextConfig;
