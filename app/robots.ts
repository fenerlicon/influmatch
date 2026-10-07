import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://influmatch.net').replace(/\/$/, '')

  return {
    rules: {
      userAgent: '*',
      allow: [
        '/',
        '/spotlight',
      ],
      disallow: [
        '/dashboard/',
        '/profile/',
        '/admin/',
        '/api/',
        '/onboarding/',
        '/login',
        '/signup',
        '/signup-role',
        '/chat/',
        '/auth/',
        '/feedback',
        '/forgot-password',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
