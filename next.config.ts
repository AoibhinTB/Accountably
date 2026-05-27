import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Force browsers / iOS PWAs to revalidate /sw.js on every visit so a
        // deployed service-worker update actually rolls out on the next PWA
        // launch instead of being held up by a cached copy.
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
