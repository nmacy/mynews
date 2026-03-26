import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  serverExternalPackages: [
    "@prisma/client", ".prisma/client",
    "jsdom", "@mozilla/readability", "@extractus/article-extractor",
    "rss-parser", "open-graph-scraper", "bcryptjs",
  ],
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
