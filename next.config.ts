import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "effective-guide-v69647v9r6qw3xj6r-3000.app.github.dev"
      ],
    },
  },
};

export default nextConfig;
