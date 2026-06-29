import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: '/english-learning',
  images: { unoptimized: true },
};

export default nextConfig;
