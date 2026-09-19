import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  output: "standalone",
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ["bullmq"],
};

export default nextConfig;
