import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pictures are already resized to 512 and 128 px before upload.
  images: { unoptimized: true },
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
