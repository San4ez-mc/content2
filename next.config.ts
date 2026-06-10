import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "content.fineko.space" },
      { protocol: "https", hostname: "content2.fineko.space" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.fal.media" },
      { protocol: "https", hostname: "**.ideogram.ai" },
    ],
  },
};

export default nextConfig;
