import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phones request /favicon.ico directly, and with no file there some kept
  // showing the old default Vercel triangle. Serve the desktop tab icon
  // (app/icon.png) at that path instead.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon.png" }];
  },
};

export default nextConfig;
