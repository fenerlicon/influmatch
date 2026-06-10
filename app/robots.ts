import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://influmatch.com'

  return {
    rules: {
      userAgent: '*',
      allow: [
        '/',
        '/spotlight',
        '/profile/',
      ],
      disallow: [
        '/dashboard/',
        '/admin/',
        '/api/',
        '/onboarding/',
        '/login',
        '/signup',
        '/signup-role',
        '/verify-phone',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
