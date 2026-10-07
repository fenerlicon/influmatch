// Resend durum tipleri ve etiketleri: istemci bileşenlerinin de kullanabildiği, sunucu kodu içermeyen kısım.

export interface ResendUsage {
  day: string // UTC gün (YYYY-MM-DD)
  daily_used: number
  month: string // UTC ay (YYYY-MM)
  monthly_used: number
  source: 'resend' | 'counter'
  updated_at: string
  last_error: string | null
  last_error_at: string | null
  quota_exceeded: 'daily' | 'monthly' | null
  quota_exceeded_at: string | null
}

export interface ResendStatus {
  checkedAt: string
  configured: boolean
  from: string
  fromDomain: string | null
  isTestSender: boolean
  key: 'ok' | 'sending_only' | 'invalid' | 'error' | 'missing'
  keyMessage: string | null
  domainStatus: string | null
  limits: { daily: number; monthly: number }
  usage: ResendUsage | null
  level: 'ok' | 'warning' | 'critical'
  problems: string[]
  warnings: string[]
  notes: string[]
}

const DOMAIN_STATUS_LABELS: Record<string, string> = {
  verified: 'doğrulandı',
  pending: 'doğrulama bekliyor (DNS kayıtları henüz görünmüyor)',
  not_started: 'doğrulama başlatılmamış',
  failed: 'doğrulama başarısız',
  temporary_failure: 'geçici doğrulama hatası',
  not_found: 'Resend hesabında bu alan adı yok',
}

export function domainStatusLabel(status: string | null) {
  return status ? DOMAIN_STATUS_LABELS[status] ?? status : null
}
