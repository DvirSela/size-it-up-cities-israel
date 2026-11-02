import type { NextConfig } from "next";

// GitHub Pages serves project sites from /<repo>/, so the static export needs a matching base path.
const base = process.env.PAGES_BASE_PATH;

const nextConfig: NextConfig = {
  output: "export",
  ...(base && { basePath: base, assetPrefix: base }),
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
