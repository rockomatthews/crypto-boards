import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // External packages configuration
  serverExternalPackages: ['@neondatabase/serverless'],
  // Disable static optimization for API routes
  env: {
    SKIP_ENV_VALIDATION: process.env.NODE_ENV === 'production' ? 'true' : 'false'
  }
};

export default nextConfig;
