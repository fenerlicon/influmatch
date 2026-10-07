// API anahtarlarının saatlik sağlık kontrolü ve admin özet e-postası.
//
// E-posta sadece durum değiştiğinde (yeni sorun / sorun düzeldi) veya süren bir sorun için
// günde bir kez gönderilir; her saat aynı uyarı tekrarlanmaz.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  API_PROVIDERS,
  PROVIDER_LABELS,
  STATUS_LABELS,
  getSystemState,
  importEnvKeyOnce,
  isKeyUsable,
  listApiKeys,
  maskSecret,
  setSystemState,
  type ApiKeyRow,
  type ApiProvider,
  type KeyCheckResult,
} from '@/lib/api-keys'
import { checkApifyKey } from '@/lib/apify'
import { checkGeminiKey } from '@/lib/gemini'
import { adminPanelUrl, sendAdminAlertEmail, type EmailResult } from '@/lib/email'
import { getResendStatus, type ResendStatus } from '@/lib/resend-status'

export const LAST_RUN_STATE_KEY = 'api_key_health_last_run'
const ALERT_STATE_KEY = 'api_key_health_alert'
const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000

/** Havuzu boş kalınca sistemin çalışmadığı servisler. Gemini şu an hiçbir modülde kullanılmıyor. */
const REQUIRED_PROVIDERS: ApiProvider[] = ['apify']
const PROBLEM_STATUSES = new Set(['low_credit', 'exhausted', 'invalid', 'error'])

export interface ProviderHealth {
  provider: ApiProvider
  total: number
  enabled: number
  usable: number
  remainingCreditUsd: number | null
  poolProblem: string | null
  problemKeys: { id: string; label: string; masked: string; status: ApiKeyRow['status']; message: string | null }[]
}

export interface HealthReport {
  checkedAt: string
  providers: ProviderHealth[]
  resend: ResendStatus
  hasProblems: boolean
  email: EmailResult | null
}

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' })

/** Tek bir anahtarı kontrol eder ve sonucu kaydeder. */
export async function checkAndStoreKey(admin: SupabaseClient, key: ApiKeyRow): Promise<ApiKeyRow> {
  const result: KeyCheckResult = key.provider === 'apify' ? await checkApifyKey(key.secret) : await checkGeminiKey(key.secret)
  const now = new Date().toISOString()

  // Gemini kotası anahtar kontrolünde görünmez: süren bir kota/hız beklemesi, anahtar geçerli diye silinmez.
  const keepCooldown =
    key.provider === 'gemini' &&
    result.status === 'active' &&
    (key.status === 'exhausted' || key.status === 'rate_limited') &&
    !!key.cooldown_until &&
    new Date(key.cooldown_until).getTime() > Date.now()

  const update: Record<string, unknown> = keepCooldown
    ? { last_checked_at: now, updated_at: now }
    : {
        status: result.status,
        status_message: result.message,
        cooldown_until: result.cooldownUntil?.toISOString() ?? null,
        last_checked_at: now,
        updated_at: now,
      }
  if (result.creditUsedUsd !== undefined) {
    update.credit_used_usd = result.creditUsedUsd
    update.credit_limit_usd = result.creditLimitUsd
    update.credit_resets_at = result.creditResetsAt
  }

  const { data, error } = await admin.from('api_keys').update(update).eq('id', key.id).select('*').single()
  if (error) {
    console.error(`[api-key-health] ${key.label} kaydedilemedi:`, error.message)
    return { ...key, ...update } as ApiKeyRow
  }
  return data as ApiKeyRow
}

function summarize(provider: ApiProvider, keys: ApiKeyRow[]): ProviderHealth {
  const enabledKeys = keys.filter((k) => k.is_enabled)
  const usable = enabledKeys.filter((k) => isKeyUsable(k)).length
  const credits = enabledKeys.filter((k) => k.credit_limit_usd !== null && k.credit_used_usd !== null)

  let poolProblem: string | null = null
  if (enabledKeys.length > 0 && usable === 0) {
    poolProblem = `${PROVIDER_LABELS[provider]} havuzunda kullanılabilir anahtar kalmadı. Bu servise bağlı özellikler çalışmıyor.`
  } else if (enabledKeys.length === 0 && REQUIRED_PROVIDERS.includes(provider)) {
    poolProblem = `${PROVIDER_LABELS[provider]} havuzunda etkin anahtar yok. Bu servise bağlı özellikler çalışmıyor.`
  }

  return {
    provider,
    total: keys.length,
    enabled: enabledKeys.length,
    usable,
    remainingCreditUsd: credits.length
      ? credits.reduce((sum, k) => sum + Math.max(Number(k.credit_limit_usd) - Number(k.credit_used_usd), 0), 0)
      : null,
    poolProblem,
    problemKeys: enabledKeys
      .filter((k) => PROBLEM_STATUSES.has(k.status))
      .map((k) => ({ id: k.id, label: k.label, masked: maskSecret(k.secret), status: k.status, message: k.status_message })),
  }
}

function buildEmailText(providers: ProviderHealth[], resend: ResendStatus, checkedAt: string, hasProblems: boolean) {
  const lines = [
    hasProblems
      ? `Influmatch API anahtarlarında sorun var (${formatDate(checkedAt)}).`
      : `Influmatch API anahtarlarındaki sorunlar giderildi (${formatDate(checkedAt)}).`,
    '',
  ]
  for (const p of providers) {
    if (p.total === 0 && !p.poolProblem) continue
    const credit = p.remainingCreditUsd !== null ? ` · Toplam kalan kredi: $${p.remainingCreditUsd.toFixed(2)}` : ''
    lines.push(`${PROVIDER_LABELS[p.provider].toUpperCase()}: ${p.usable}/${p.enabled} etkin anahtar kullanılabilir${credit}`)
    if (p.poolProblem) lines.push(`  !! ${p.poolProblem}`)
    for (const k of p.problemKeys) {
      lines.push(`  - ${k.label} (${k.masked}): ${STATUS_LABELS[k.status]}${k.message ? ` — ${k.message}` : ''}`)
    }
    lines.push('')
  }
  if (resend.level !== 'ok' || resend.usage) {
    const u = resend.usage
    lines.push(
      `E-POSTA (RESEND): ${u ? `bugün ${u.daily_used}/${resend.limits.daily}, bu ay ${u.monthly_used}/${resend.limits.monthly}` : 'kullanım verisi yok'}`,
    )
    for (const p of resend.problems) lines.push(`  !! ${p}`)
    for (const w of resend.warnings) lines.push(`  - ${w}`)
    lines.push('')
  }
  lines.push(`Anahtar eklemek / değiştirmek için: ${adminPanelUrl('/admin/api-keys')}`)
  return lines.join('\n')
}

/**
 * Tüm etkin anahtarları kontrol eder. sendEmail true ise (saatlik görev) gerektiğinde admin'e özet atar.
 */
export async function runApiKeyHealthCheck(admin: SupabaseClient, { sendEmail }: { sendEmail: boolean }): Promise<HealthReport> {
  for (const provider of API_PROVIDERS) {
    await importEnvKeyOnce(admin, provider)
  }

  const allKeys = await listApiKeys(admin)
  const checked = await Promise.all(allKeys.map((key) => (key.is_enabled ? checkAndStoreKey(admin, key) : Promise.resolve(key))))

  const checkedAt = new Date().toISOString()
  const providers = API_PROVIDERS.map((provider) => summarize(provider, checked.filter((k) => k.provider === provider)))
  const resend = await getResendStatus(admin)
  const hasProblems = providers.some((p) => p.poolProblem || p.problemKeys.length > 0) || resend.level !== 'ok'

  let email: EmailResult | null = null
  if (sendEmail) {
    // Resend için yalnızca seviye parmak izine girer (sayaçlar her saat değişir, e-posta tekrarlanmasın).
    const fingerprint = JSON.stringify([
      providers.map((p) => [p.provider, !!p.poolProblem, p.problemKeys.map((k) => `${k.id}:${k.status}`).sort()]),
      ['resend', resend.level, resend.problems.length],
    ])
    const lastAlert = await getSystemState<{ fingerprint?: string; sent_at?: string; had_problems?: boolean }>(admin, ALERT_STATE_KEY)
    const changed = lastAlert?.fingerprint !== fingerprint
    const reminderDue = !lastAlert?.sent_at || Date.now() - new Date(lastAlert.sent_at).getTime() >= REMINDER_INTERVAL_MS
    const shouldSend = hasProblems ? changed || reminderDue : changed && !!lastAlert?.had_problems

    if (shouldSend) {
      const urgent = providers.some((p) => p.poolProblem) || resend.level === 'critical'
      email = await sendAdminAlertEmail({
        subject: hasProblems
          ? `[Influmatch] ${urgent ? 'ACİL: ' : ''}API anahtar uyarısı`
          : '[Influmatch] API anahtarları tekrar sağlıklı',
        text: buildEmailText(providers, resend, checkedAt, hasProblems),
      })
      if (email.sent) {
        await setSystemState(admin, ALERT_STATE_KEY, { fingerprint, sent_at: checkedAt, had_problems: hasProblems })
      }
    }

    await setSystemState(admin, LAST_RUN_STATE_KEY, {
      ran_at: checkedAt,
      has_problems: hasProblems,
      email_sent: email?.sent ?? false,
      email_error: email && !email.sent ? email.reason : null,
    })
  }

  return { checkedAt, providers, resend, hasProblems, email }
}
