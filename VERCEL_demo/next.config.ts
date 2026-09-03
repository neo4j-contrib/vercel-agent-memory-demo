import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  serverExternalPackages: ["@neo4j-labs/agent-memory"],
  allowedDevOrigins: ["127.0.0.1"],
};

export default withEve(nextConfig);
