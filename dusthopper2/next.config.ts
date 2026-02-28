import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.nasa.gov" },
      { protocol: "https", hostname: "**.esa.int" },
      { protocol: "https", hostname: "spacelaunchnow-prod-east.nyc3.digitaloceanspaces.com" },
    ],
  },
};

export default nextConfig;
