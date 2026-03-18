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
      {
        source: '/tiktokennC3hH91oikg0dKY5dyXqqVMLRuJPzc.txt/',
        destination: '/tiktokennC3hH91oikg0dKY5dyXqqVMLRuJPzc.txt',
      },
    ]
  },
}

module.exports = nextConfig;