// Portföyde iş birliği sonuçları (SYSTEM_MAP 4.3-S7, 3.20-N6) — sunucu ve tarayıcı ortak tipler ve metinler.
// Mobil karşılığı: mobile-app/constants/portfolio.js (metinler birlikte değişir).

import type { EngagementRate, MetricPlatform, MetricTrackingStatus } from '@/lib/post-metrics-shared'

export interface PortfolioPost {
  deliverable_id: string
  /** Teslimat türü etiketi (Story, Reels, Gönderi, UGC video, Diğer). */
  kind: string
  platform: MetricPlatform | null
  published_at: string | null
  /** Gönderi bağlantısı: sahibine her zaman; başkalarına yalnızca marka adının görünmesine izin verdiyse (bağlantı markayı gösterir). */
  post_url: string | null
  status: MetricTrackingStatus | null
  latest: { views: number | null; likes: number | null; comments: number | null; captured_at: string } | null
  engagement: EngagementRate | null
}

export interface PortfolioItem {
  collaboration_id: string
  brand: {
    /** Gösterilen ad: marka izin verdiyse adı, vermediyse "Bir marka". */
    label: string
    name_visible: boolean
    /** Yalnızca marka adı görünürse (profil bağlantısı için). */
    username: string | null
    /** Marka sektörü etiketi (ad gizliyken de gösterilir). */
    sector: string | null
  }
  kinds: string[]
  published_at: string | null
  completed_at: string | null
  posts: PortfolioPost[]
  totals: { views: number | null; likes: number; comments: number; engagement: EngagementRate | null; measured: number }
  /** Yalnızca sahibine: portföyde gizli mi. Başkalarına gizli kayıt hiç gönderilmez. */
  hidden: boolean
  /** Yalnızca sahibine: markanın gerçek adı (ad gizli olsa bile sahibi bilir). */
  owner_brand_name: string | null
}

export type PortfolioView =
  | { mode: 'public'; items: PortfolioItem[] }
  | { mode: 'owner'; items: PortfolioItem[]; /** Influencer Pro aktif mi (bölüm başkalarına yalnızca o zaman görünür). */ pro: boolean }

export const PORTFOLIO_TITLE = 'Sonuçlar'
export const PORTFOLIO_DESCRIPTION = 'Tamamlanan iş birliklerindeki gönderilerin ölçülen sonuçları.'
export const PORTFOLIO_PRO_NOTE =
  'Sonuçlar bölümü profilinde başkalarına yalnızca Influencer Pro üyeliğinde görünür. Sonuçlarını burada ve iş birliği detayında her zaman görebilirsin.'
export const PORTFOLIO_OWNER_NOTE =
  'Bu bölüm profilini görüntüleyen giriş yapmış kullanıcılara görünür. Gizlediğin iş birlikleri kimseye gösterilmez. Markası izin vermeyen iş birliklerinde marka adı ve gönderi bağlantısı yerine "Bir marka" ve sektörü görünür.'
export const PORTFOLIO_EMPTY_OWNER = 'Henüz tamamlanmış ve yayın linki girilmiş bir iş birliğin yok.'
export const BRAND_PORTFOLIO_SETTING_LABEL = 'İş birliği sonuçlarımda markamın adı görünsün'
export const BRAND_PORTFOLIO_SETTING_HELP =
  'Açıksa, birlikte çalıştığın influencer/UGC profillerinin "Sonuçlar" bölümünde markanın adı ve gönderi bağlantısı görünür. Kapalıysa yalnızca "Bir marka" ve sektörün yazar.'
export const ANONYMOUS_BRAND_LABEL = 'Bir marka'
