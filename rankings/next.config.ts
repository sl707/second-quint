import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pictures are already resized to 512 and 128 px before upload.
  images: { unoptimized: true },
  // Room for both resized sizes of a contestant picture (each at most 700 KB) in one Server Action.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
