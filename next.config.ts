import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  // Self-contained server build for Docker / any Node host.
  output: "standalone",
};

export default nextConfig;
