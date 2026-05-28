import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Surface the commit SHA at build time so /about and /you can display
  // it. Vercel sets VERCEL_GIT_COMMIT_SHA; locally it falls back to "dev".
  env: {
    NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
  },
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
