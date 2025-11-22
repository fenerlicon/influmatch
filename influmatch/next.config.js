/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true, // TS hatalarını yoksay
  },
  eslint: {
    ignoreDuringBuilds: true, // Lint (Tırnak, hook vb.) hatalarını yoksay
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

module.exports = nextConfig