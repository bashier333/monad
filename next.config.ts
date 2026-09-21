import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  output: "standalone",
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ["bullmq"],
  experimental: { optimizePackageImports: ["lucide-react", "recharts"] },
  // The download route reads release artifacts from dist/ at runtime, but
  // dist/ must never be traced INTO the standalone server (previously it
  // dragged 2.4GB of win-unpacked into the bundle and broke NSIS). The
  // packaged exe serves downloads via MONAD_DIST_PATH, not this default.
  // Route keys are picomatch globs where * does not cross / — so the
  // download route (/api/download/exe) needs an explicit entry; the global
  // key is belt-and-suspenders. Without this, tracing follows the route's
  // path.join(process.cwd(), "dist", …) into dist/ and nests every previous
  // packaging output inside the next server bundle, recursively.
  outputFileTracingExcludes: {
    "/api/download/exe": ["./dist/**/*"],
    "/**/*": ["./dist/**/*"],
  },
};

export default nextConfig;
