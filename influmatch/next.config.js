/** @type {import('next').NextConfig} */
const nextConfig = {
  // TypeScript hatalarını görmezden gel
  typescript: {
    ignoreBuildErrors: true,
  },
  // ESLint hatalarını görmezden gel
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Resim kaynaklarına izin ver (Supabase, Unsplash vb.)
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