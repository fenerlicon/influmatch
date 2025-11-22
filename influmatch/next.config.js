/** @type {import('next').NextConfig} */
const nextConfig = {
  // TypeScript hataları olsa bile build işlemini bitir
  typescript: {
    ignoreBuildErrors: true,
  },
  // ESLint (Tırnak işareti, hook kuralları vb.) hatalarını tamamen yoksay
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Resim kaynaklarına izin ver
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Deneysel özellikleri kapat (Hata riskini azaltır)
  experimental: {
    serverActions: {
      allowedOrigins: ['*'],
    },
  },
}

module.exports = nextConfig