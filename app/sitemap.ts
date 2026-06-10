import { MetadataRoute } from 'next'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://influmatch.com'

  // Static routes
  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/spotlight`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
  ]

  // Dynamic routes (Verified influencer public profiles)
  try {
    const supabase = createSupabaseAdminClient()
    if (supabase) {
      const { data: influencers } = await supabase
        .from('users')
        .select('username, created_at')
        .eq('role', 'influencer')
        .eq('verification_status', 'verified')
        .not('username', 'is', null)

      if (influencers && influencers.length > 0) {
        influencers.forEach((influencer) => {
          routes.push({
            url: `${baseUrl}/profile/${influencer.username}`,
            lastModified: influencer.created_at ? new Date(influencer.created_at) : new Date(),
            changeFrequency: 'weekly' as const,
            priority: 0.6,
          })
        })
      }
    }
  } catch (error) {
    console.error('[Sitemap] Failed to generate dynamic sitemap entries:', error)
  }

  return routes
}
