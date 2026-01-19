/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  productionBrowserSourceMaps: false,
  // Turbopack configuration (Next.js 16+)
  turbopack: {
    // Source maps disabled for client bundles
  },
}

export default nextConfig

