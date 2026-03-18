/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/tiktokbqod9Dsb8AiJnWB3R7037aLZA191TBEP.txt/',
        destination: '/tiktokbqod9Dsb8AiJnWB3R7037aLZA191TBEP.txt',
      },
    ]
  },
}

module.exports = nextConfig;