/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Vergi levhası PDF okuyucusu webpack ile paketlenmeden Node tarafından yüklenir.
    serverComponentsExternalPackages: ['unpdf'],
  },
  images: {
    // Yalnızca kendi depomuz ve sosyal platform CDN'leri optimize edilir. Önceki '**' kalıbı
    // görsel optimizasyonunu herkese açık bir proxy yapıyordu (Vercel görsel kotası/maliyeti).
    remotePatterns: [
      { protocol: 'https', hostname: 'aiftdpagcnwqzzemtkwt.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: '**.tiktokcdn.com' },
      { protocol: 'https', hostname: '**.tiktokcdn-us.com' },
    ],
    // Optimize edilmiş görseller 31 gün önbellekte kalır; aynı görsel tekrar dönüştürülmez.
    minimumCacheTTL: 2678400,
    // Avatar boyutları (28–96 px, 2x ekran dahil) için küçük genişlikler: her görsel az sayıda varyantla dönüştürülür.
    imageSizes: [32, 48, 64, 96, 128, 192, 256, 384],
    formats: ['image/webp'],
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