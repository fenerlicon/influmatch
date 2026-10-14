// Sonuç raporu (SYSTEM_MAP 3.20) sabitleri ve hesapları (sunucu ve tarayıcı ortak; sunucuya özel içe aktarım yok).
// Mobil karşılığı: mobile-app/constants/postMetrics.js (ikisi birlikte değişir).
//
// Yalnızca ölçülen sayılar gösterilir: kıyas, "sektör ortalaması" ya da tahmin yok.

export type MetricPlatform = 'instagram' | 'tiktok' | 'youtube' | 'other'
export type MetricTrackingStatus = 'active' | 'done' | 'unavailable' | 'unsupported'
export type MetricStage = 'd1' | 'd7' | 'd30' | 'manual'

/** Otomatik ölçüm anları: yayından 1, 7 ve 30 gün sonra; sonra durur. */
export const METRIC_SCHEDULE: Array<{ stage: Exclude<MetricStage, 'manual'>; days: number }> = [
  { stage: 'd1', days: 1 },
  { stage: 'd7', days: 7 },
  { stage: 'd30', days: 30 },
]

/** Marka bir teslimatı en fazla bu sıklıkta elle güncelleyebilir. */
export const MANUAL_REFRESH_HOURS = 6
/** Arka arkaya bu kadar başarısız ölçümden sonra gönderi "ulaşılamıyor" sayılır ve denenmez. */
export const METRIC_MAX_FAILURES = 3

export const METRIC_STAGE_LABELS: Record<MetricStage, string> = {
  d1: '1. gün',
  d7: '7. gün',
  d30: '30. gün',
  manual: 'Elle güncelleme',
}

export const METRIC_STATUS_LABELS: Record<MetricTrackingStatus, string> = {
  active: 'Ölçülüyor',
  done: 'Ölçüm tamamlandı (30 gün)',
  unavailable: 'Gönderiye ulaşılamıyor (silinmiş ya da gizli olabilir)',
  unsupported: 'Bu bağlantı için ölçüm yok',
}

export const METRIC_PLATFORM_LABELS: Record<MetricPlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  other: 'Diğer',
}

export interface MetricSnapshot {
  stage: MetricStage
  likes: number | null
  comments: number | null
  views: number | null
  shares: number | null
  captured_at: string
}

export type EngagementBasis = 'views' | 'followers'

export interface EngagementRate {
  /** Yüzde (ör. 4.25 = %4,25). */
  value: number
  basis: EngagementBasis
}

export interface DeliverableMetrics {
  deliverable_id: string
  platform: MetricPlatform
  status: MetricTrackingStatus
  post_url: string
  published_at: string
  followers_at_publish: number | null
  next_stage: MetricStage | null
  next_due_at: string | null
  last_success_at: string | null
  /** Yeniden en erken (yeni ölçüm önce) — son 10 ölçüm. */
  snapshots: MetricSnapshot[]
  latest: MetricSnapshot | null
  engagement: EngagementRate | null
  /** Yalnızca marka için: "Şimdi güncelle" düğmesinin açık olup olmadığı ve değilse ne zaman açılacağı. */
  manual: { allowed: boolean; available_at: string | null } | null
}

/** Etkileşim = (beğeni + yorum) / izlenme; izlenme yoksa yayın anındaki takipçi sayısına göre. */
export function engagementOf(
  s: Pick<MetricSnapshot, 'likes' | 'comments' | 'views'> | null,
  followersAtPublish: number | null,
): EngagementRate | null {
  if (!s) return null
  const interactions = (s.likes ?? 0) + (s.comments ?? 0)
  if (s.likes === null && s.comments === null) return null
  if (s.views && s.views > 0) return { value: (interactions / s.views) * 100, basis: 'views' }
  if (followersAtPublish && followersAtPublish > 0) return { value: (interactions / followersAtPublish) * 100, basis: 'followers' }
  return null
}

export function engagementLabel(basis: EngagementBasis) {
  return basis === 'views' ? 'Etkileşim (izlenmeye göre)' : 'Etkileşim (yayın anındaki takipçiye göre)'
}

export function formatCount(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('tr-TR')
}

export function formatPercent(rate: EngagementRate | null | undefined) {
  if (!rate) return '—'
  return `%${rate.value.toLocaleString('tr-TR', { maximumFractionDigits: 2, minimumFractionDigits: rate.value < 10 ? 2 : 1 })}`
}

export function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return `${value.toLocaleString('tr-TR', { maximumFractionDigits: value < 100 ? 2 : 0 })} ₺`
}

// --- Kampanya sonuçları ------------------------------------------------------------------------------

export interface CampaignResultRow {
  key: string
  collaboration_id: string
  creator: { id: string; full_name: string | null; username: string | null; avatar_url: string | null }
  /** Yayın linki girilmiş teslimat sayısı. */
  posts_live: number
  /** En az bir ölçümü olan gönderi sayısı. */
  posts_measured: number
  views: number | null
  likes: number
  comments: number
  engagement: EngagementRate | null
  /** Anlaşılan nakit ücret (yalnızca nakit ve 0'dan büyükse; barter / ücretsiz hesaba katılmaz). */
  cash_fee: number | null
  /** 1000 izlenme başı maliyet: yalnızca nakit ücret varsa ve ölçülen bütün gönderilerde izlenme sayısı varsa. */
  cost_per_1000_views: number | null
  /** Etkileşim (beğeni + yorum) başı maliyet: yalnızca nakit ücret ve en az bir etkileşim varsa. */
  cost_per_engagement: number | null
  last_captured_at: string | null
  unavailable: number
  unsupported: number
}

export interface CampaignResultsSummary {
  creators: number
  posts_live: number
  posts_measured: number
  views: number | null
  likes: number
  comments: number
  engagement: EngagementRate | null
  cost_per_1000_views: number | null
  cost_per_engagement: number | null
  unavailable: number
  unsupported: number
  last_captured_at: string | null
}

export interface CampaignResults {
  rows: CampaignResultRow[]
  summary: CampaignResultsSummary
}

export const COST_NOTE =
  'Maliyetler yalnızca anlaşma özetindeki nakit ücretlerden hesaplanır; barter ve ücretsiz iş birlikleri dahil değildir. 1000 izlenme başı maliyet, bütün gönderilerinde izlenme sayısı ölçülen profiller için gösterilir.'
export const METRICS_SOURCE_NOTE =
  'Sayılar gönderilerin herkese açık sayfasından ölçülür (yayından 1, 7 ve 30 gün sonra). Story ve YouTube bağlantıları şimdilik ölçülmez.'
