// Apify çağrıları: anahtar havuzu üzerinden actor çalıştırma ve anahtar/kredi kontrolü.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import {
  ApiKeyError,
  ApiRequestError,
  ApiServiceError,
  fetchExternal,
  withApiKey,
  type KeyCheckResult,
} from '@/lib/api-keys'

const APIFY_BASE = 'https://api.apify.com/v2'

/** Kalan kredi bu değerin altına düşünce anahtar "kredi azaldı" sayılır. */
const LOW_CREDIT_MIN_USD = 1
const LOW_CREDIT_RATIO = 0.2
/** Bir actor çalıştırmasına yetmeyecek kadar az kredi "bitti" sayılır. */
const EXHAUSTED_BELOW_USD = 0.05

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60 * 1000)

async function classifyApifyError(response: Response): Promise<Error> {
  const body = await response.text().catch(() => '')
  let type = ''
  let message = body.slice(0, 300)
  try {
    const parsed = JSON.parse(body)
    type = parsed?.error?.type ?? ''
    message = parsed?.error?.message ?? message
  } catch {
    // JSON olmayan hata gövdesi
  }
  const detail = `${type ? `${type}: ` : ''}${message}`.trim()

  // Eşzamanlı çalıştırma bellek limiti kredi bitmesi değildir: kısa bekleme yeterli.
  if (/memory/i.test(`${type} ${message}`)) {
    return new ApiKeyError('rate_limited', `Apify eşzamanlı çalıştırma limiti: ${detail}`, minutesFromNow(1))
  }
  if (response.status === 401) {
    return new ApiKeyError('invalid', `Apify anahtarı geçersiz. ${detail}`)
  }
  if (response.status === 402) {
    // Saatlik kontrol, kredinin gerçekten ne zaman yenileneceğini (ay sonu) bulup bekleme süresini günceller.
    return new ApiKeyError('exhausted', `Apify kredisi yetersiz. ${detail}`, minutesFromNow(60))
  }
  if (response.status === 403) {
    if (/usage|limit|credit|plan|billing|payment|exceed/i.test(`${type} ${message}`)) {
      return new ApiKeyError('exhausted', `Apify kullanım limiti doldu. ${detail}`, minutesFromNow(60))
    }
    return new ApiKeyError('invalid', `Apify anahtarının yetkisi yok. ${detail}`)
  }
  if (response.status === 429) {
    return new ApiKeyError('rate_limited', `Apify hız limiti aşıldı. ${detail}`, minutesFromNow(1))
  }
  if (response.status === 408 || response.status >= 500) {
    return new ApiServiceError(`Apify servis hatası (HTTP ${response.status}). ${detail}`)
  }
  return new ApiRequestError(`Apify isteği reddedildi (HTTP ${response.status}). ${detail}`)
}

/** Actor'ı senkron çalıştırır ve veri kümesindeki kayıtları döndürür. */
export async function runApifyActor<T = any>(actorId: string, input: unknown): Promise<T[]> {
  return withApiKey('apify', async (token) => {
    const response = await fetchExternal(
      `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(input),
      },
      'Apify',
    )
    if (!response.ok) throw await classifyApifyError(response)
    return (await response.json()) as T[]
  })
}

/** Anahtarın geçerliliğini ve bu ayki kalan kredisini kontrol eder (kredi harcamaz). */
export async function checkApifyKey(token: string): Promise<KeyCheckResult> {
  try {
    const response = await fetchExternal(`${APIFY_BASE}/users/me/limits`, { headers: { Authorization: `Bearer ${token}` } }, 'Apify')
    if (!response.ok) throw await classifyApifyError(response)

    const { data } = await response.json()
    const used = Number(data?.current?.monthlyUsageUsd ?? 0)
    const limit = Number(data?.limits?.maxMonthlyUsageUsd ?? 0)
    const resetsAt: string | null = data?.monthlyUsageCycle?.endAt ?? null
    const remaining = limit - used
    const credit = { creditUsedUsd: used, creditLimitUsd: limit, creditResetsAt: resetsAt }
    const remainingText = `Kalan kredi $${Math.max(remaining, 0).toFixed(2)} / $${limit.toFixed(2)}`
    const resetText = resetsAt
      ? ` · Yenilenme: ${new Date(resetsAt).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}`
      : ''

    if (remaining < EXHAUSTED_BELOW_USD) {
      return { status: 'exhausted', message: `${remainingText}${resetText}`, cooldownUntil: resetsAt ? new Date(resetsAt) : minutesFromNow(60), ...credit }
    }
    if (remaining < Math.max(LOW_CREDIT_MIN_USD, limit * LOW_CREDIT_RATIO)) {
      return { status: 'low_credit', message: `${remainingText}${resetText}`, cooldownUntil: null, ...credit }
    }
    return { status: 'active', message: null, cooldownUntil: null, ...credit }
  } catch (error) {
    if (error instanceof ApiKeyError) return { status: error.kind, message: error.message, cooldownUntil: error.cooldownUntil }
    return { status: 'error', message: error instanceof Error ? error.message : String(error), cooldownUntil: null }
  }
}
