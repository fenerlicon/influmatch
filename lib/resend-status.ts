// Resend (e-posta) kullanım ölçümü ve sağlık kontrolü.
//
// Ücretsiz plan: günde 100, ayda 3000 e-posta (RESEND_DAILY_LIMIT / RESEND_MONTHLY_LIMIT ile değişir).
// Kurumsal e-posta kodları ve admin uyarıları aynı kotayı paylaşır; kota dolunca markalara kod gitmez.
//
// Kullanım iki kaynaktan gelir:
//   1. Resend her gönderim yanıtında x-resend-daily-quota / x-resend-monthly-quota başlıklarıyla
//      o ana kadar kullanılan miktarı döner (hesaptaki tüm gönderimler dahil, en doğru kaynak).
//   2. Başlık gelmezse kendi sayacımız (sadece bu uygulamanın gönderimleri).
// Sağlık kontrolü e-posta göndermez (kota harcamaz): GET /domains ile anahtarı ve alan adını kontrol eder.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getSystemState, setSystemState } from '@/lib/api-keys'
import { domainStatusLabel, type ResendStatus, type ResendUsage } from '@/lib/resend-status-shared'

export { domainStatusLabel, type ResendStatus, type ResendUsage }

export const RESEND_USAGE_STATE_KEY = 'resend_usage'
export const DEFAULT_EMAIL_FROM = 'Influmatch <onboarding@resend.dev>'
const WARN_RATIO = 0.8
const RECENT_ERROR_MS = 24 * 60 * 60 * 1000

function positiveInt(value: string | undefined, fallback: number) {
  const n = Number.parseInt(value ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function resendLimits() {
  return {
    daily: positiveInt(process.env.RESEND_DAILY_LIMIT, 100),
    monthly: positiveInt(process.env.RESEND_MONTHLY_LIMIT, 3000),
  }
}

export function resolveFromAddress() {
  return process.env.EMAIL_FROM?.trim() || process.env.ALERT_EMAIL_FROM?.trim() || DEFAULT_EMAIL_FROM
}

export function emailDomainOf(from: string): string | null {
  const match = from.match(/@([^\s>]+)\s*>?\s*$/)
  return match ? match[1].toLowerCase() : null
}

const utcDay = (d: Date) => d.toISOString().slice(0, 10)
const utcMonth = (d: Date) => d.toISOString().slice(0, 7)

/** Gün/ay değiştiyse sayaçları ve süresi geçmiş kota uyarısını sıfırlar. */
export function rolloverUsage(prev: ResendUsage | null, now = new Date()): ResendUsage {
  const day = utcDay(now)
  const month = utcMonth(now)
  const base: ResendUsage = prev ?? {
    day,
    daily_used: 0,
    month,
    monthly_used: 0,
    source: 'counter',
    updated_at: now.toISOString(),
    last_error: null,
    last_error_at: null,
    quota_exceeded: null,
    quota_exceeded_at: null,
  }
  const next = { ...base }
  if (next.day !== day) {
    next.day = day
    next.daily_used = 0
    if (next.quota_exceeded === 'daily') next.quota_exceeded = null
  }
  if (next.month !== month) {
    next.month = month
    next.monthly_used = 0
    if (next.quota_exceeded === 'monthly') next.quota_exceeded = null
  }
  if (!next.quota_exceeded) next.quota_exceeded_at = null
  return next
}

function headerInt(response: Response, name: string): number | null {
  const n = Number.parseInt(response.headers.get(name) ?? '', 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Bir gönderim denemesinin sonucunu kaydeder. Asla hata fırlatmaz (gönderimi etkilemez). */
export async function recordResendResult(
  admin: SupabaseClient | null,
  outcome: { response?: Response; errorName?: string | null; errorMessage?: string | null; recipients: number },
) {
  if (!admin) return
  try {
    const now = new Date()
    const usage = rolloverUsage(await getSystemState<ResendUsage>(admin, RESEND_USAGE_STATE_KEY), now)
    const { response } = outcome
    const ok = !!response?.ok

    if (response) {
      const daily = headerInt(response, 'x-resend-daily-quota')
      const monthly = headerInt(response, 'x-resend-monthly-quota')
      if (daily !== null || monthly !== null) {
        if (daily !== null) usage.daily_used = daily
        if (monthly !== null) usage.monthly_used = monthly
        usage.source = 'resend'
      } else if (ok) {
        usage.daily_used += outcome.recipients
        usage.monthly_used += outcome.recipients
      }
    }

    if (ok) {
      usage.quota_exceeded = null
      usage.quota_exceeded_at = null
    } else if (outcome.errorName === 'daily_quota_exceeded' || outcome.errorName === 'monthly_quota_exceeded') {
      usage.quota_exceeded = outcome.errorName === 'daily_quota_exceeded' ? 'daily' : 'monthly'
      usage.quota_exceeded_at = now.toISOString()
      usage.last_error = outcome.errorMessage || outcome.errorName
      usage.last_error_at = now.toISOString()
    } else {
      usage.last_error = (outcome.errorMessage || outcome.errorName || 'Bilinmeyen hata').slice(0, 300)
      usage.last_error_at = now.toISOString()
    }

    usage.updated_at = now.toISOString()
    await setSystemState(admin, RESEND_USAGE_STATE_KEY, usage as unknown as Record<string, unknown>)
  } catch (error) {
    console.error('[resend-status] Kullanım kaydedilemedi:', error)
  }
}

async function checkKeyAndDomain(apiKey: string, fromDomain: string | null) {
  try {
    const response = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    const body = (await response.json().catch(() => ({}))) as {
      name?: string
      message?: string
      data?: { name?: string; status?: string }[]
    }
    if (response.ok) {
      const domain = fromDomain ? body.data?.find((d) => d.name?.toLowerCase() === fromDomain) : undefined
      return { key: 'ok' as const, keyMessage: null, domainStatus: fromDomain ? domain?.status ?? 'not_found' : null }
    }
    if (body.name === 'restricted_api_key') {
      return { key: 'sending_only' as const, keyMessage: null, domainStatus: null }
    }
    if (response.status === 401 || response.status === 403 || body.name === 'validation_error') {
      return { key: 'invalid' as const, keyMessage: body.message || `HTTP ${response.status}`, domainStatus: null }
    }
    return { key: 'error' as const, keyMessage: body.message || `HTTP ${response.status}`, domainStatus: null }
  } catch (error) {
    return { key: 'error' as const, keyMessage: error instanceof Error ? error.message : String(error), domainStatus: null }
  }
}

/** Anahtar, gönderici alan adı ve kota durumunu değerlendirir. E-posta göndermez. */
export async function getResendStatus(admin: SupabaseClient | null): Promise<ResendStatus> {
  const now = new Date()
  const limits = resendLimits()
  const from = resolveFromAddress()
  const fromDomain = emailDomainOf(from)
  const isTestSender = fromDomain === 'resend.dev'
  const apiKey = process.env.RESEND_API_KEY?.trim() || ''
  const usage = admin ? rolloverUsage(await getSystemState<ResendUsage>(admin, RESEND_USAGE_STATE_KEY), now) : null

  const problems: string[] = []
  const warnings: string[] = []
  const notes: string[] = []

  let key: ResendStatus['key'] = 'missing'
  let keyMessage: string | null = null
  let domainStatus: string | null = null

  if (!apiKey) {
    problems.push('RESEND_API_KEY tanımlı değil: hiçbir e-posta gönderilemiyor.')
  } else {
    ;({ key, keyMessage, domainStatus } = await checkKeyAndDomain(apiKey, isTestSender ? null : fromDomain))
    if (key === 'invalid') problems.push(`Resend anahtarı geçersiz${keyMessage ? `: ${keyMessage}` : ''}.`)
    if (key === 'error') warnings.push(`Resend'e ulaşılamadı${keyMessage ? `: ${keyMessage}` : ''}.`)
    if (key === 'sending_only') notes.push('Anahtar yalnızca gönderim yetkili; alan adı durumu buradan okunamıyor (sorun değil).')
  }

  if (isTestSender) {
    problems.push('EMAIL_FROM tanımlı değil: test göndericisi (onboarding@resend.dev) yalnızca Resend hesap sahibine e-posta atar, markalara doğrulama kodu gitmez.')
  } else if (domainStatus && domainStatus !== 'verified') {
    problems.push(`Gönderici alan adı ${fromDomain}: ${domainStatusLabel(domainStatus)}. Doğrulanmadan e-postalar gönderilmez.`)
  }

  if (usage) {
    if (usage.quota_exceeded) {
      problems.push(usage.quota_exceeded === 'daily' ? 'Günlük e-posta kotası doldu: yarına kadar e-posta gönderilemiyor.' : 'Aylık e-posta kotası doldu.')
    }
    for (const [label, used, limit] of [
      ['Günlük', usage.daily_used, limits.daily],
      ['Aylık', usage.monthly_used, limits.monthly],
    ] as const) {
      if (usage.quota_exceeded) break
      if (used >= limit) problems.push(`${label} e-posta kotası doldu (${used}/${limit}).`)
      else if (used >= limit * WARN_RATIO) warnings.push(`${label} e-posta kotasının %${Math.round((used / limit) * 100)}'i kullanıldı (${used}/${limit}).`)
    }
    if (!usage.quota_exceeded && usage.last_error && usage.last_error_at && now.getTime() - new Date(usage.last_error_at).getTime() < RECENT_ERROR_MS) {
      warnings.push(`Son 24 saatte gönderim hatası: ${usage.last_error}`)
    }
  }

  return {
    checkedAt: now.toISOString(),
    configured: !!apiKey,
    from,
    fromDomain,
    isTestSender,
    key,
    keyMessage,
    domainStatus,
    limits,
    usage,
    level: problems.length ? 'critical' : warnings.length ? 'warning' : 'ok',
    problems,
    warnings,
    notes,
  }
}
