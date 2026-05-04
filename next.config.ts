import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["mongodb"],
  async rewrites() {
    return [
      {
        source: "/image-search-proxy/:path*",
        destination: "http://image-search-mcp:8080/:path*",
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ensure mongodb and related Node.js-only modules are treated as external
      // in the instrumentation.ts webpack compilation context
      const existingExternals = config.externals || [];
      config.externals = [
        ...(Array.isArray(existingExternals) ? existingExternals : [existingExternals]),
        "mongodb",
      ];
    }
    return config;
  },
};

export default nextConfig;
