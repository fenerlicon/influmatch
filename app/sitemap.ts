import { MetadataRoute } from 'next'

// Yalnızca giriş gerektirmeyen sayfalar listelenir. Profil sayfaları giriş istediği için
// arama motorlarına bildirilmez (açılamayan sayfaları göndermek dizinlemeye zarar verir ve
// kullanıcı adlarının tam listesini dışarı açar).
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://influmatch.net').replace(/\/$/, '')
  const now = new Date()

  return [
    { url: baseUrl, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/spotlight`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/badges`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/legal`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
