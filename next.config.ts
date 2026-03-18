import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: 'standalone',  // Add this line
    typescript: {
        ignoreBuildErrors: true,
    }
}

export default nextConfig;