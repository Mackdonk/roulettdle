import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Parent folders may contain other lockfiles; pin workspace root to this app.
  turbopack: {
    root: __dirname,
  },
  experimental: {
    optimizePackageImports: ["@mantine/core", "@mantine/hooks"],
  },
};

export default nextConfig;
