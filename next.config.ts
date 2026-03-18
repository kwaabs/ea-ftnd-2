import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: 'standalone',  // Add this line and save
    typescript: {
        ignoreBuildErrors: true,
    }
}

export default nextConfig;