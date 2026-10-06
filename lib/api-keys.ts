// Harici servis anahtar havuzu (Apify, Gemini).
//
// Anahtarlar admin panelinden (/admin/api-keys) public.api_keys tablosuna eklenir.
// Her çağrı sıradaki kullanılabilir anahtarla yapılır; anahtar kaynaklı bir hata
// (geçersiz anahtar, kredi/kota bitti, hız limiti) alınırsa anahtar işaretlenir ve
// sıradaki anahtarla tekrar denenir. Hiçbir anahtar kalmazsa admin e-postayla uyarılır.
//
// Ortam değişkenindeki eski anahtar (APIFY_API_TOKEN / GEMINI_API_KEY), havuz boşken
// bir kez havuza aktarılır. Tablo henüz yoksa (migration çalışmadıysa) doğrudan kullanılır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { sendAdminAlertEmail, adminPanelUrl } from '@/lib/email'

export type ApiProvider = 'apify' | 'gemini'
export type ApiKeyStatus = 'unknown' | 'active' | 'low_credit' | 'exhausted' | 'rate_limited' | 'invalid' | 'error'

export const API_PROVIDERS: ApiProvider[] = ['apify', 'gemini']

export const PROVIDER_LABELS: Record<ApiProvider, string> = {
  apify: 'Apify',
  gemini: 'Gemini',
}

export const STATUS_LABELS: Record<ApiKeyStatus, string> = {
  unknown: 'Kontrol edilmedi',
  active: 'Aktif',
  low_credit: 'Kredi azaldı',
  exhausted: 'Kredi/kota bitti',
  rate_limited: 'Hız limiti (geçici)',
  invalid: 'Geçersiz',
  error: 'Hata',
}

const ENV_KEY_NAMES: Record<ApiProvider, string> = {
  apify: 'APIFY_API_TOKEN',
  gemini: 'GEMINI_API_KEY',
}

const POOL_DEPLETED_ALERT_INTERVAL_MS = 60 * 60 * 1000

/** Anahtar kaynaklı hata: anahtar işaretlenir ve sıradaki anahtar denenir. */
export class ApiKeyError extends Error {
  constructor(
    readonly kind: 'invalid' | 'exhausted' | 'rate_limited',
    message: string,
    readonly cooldownUntil: Date | null = null,
  ) {
    super(message)
    this.name = 'ApiKeyError'
  }
}

/** Servis tarafı geçici hata (5xx, zaman aşımı, ağ). Anahtar değiştirmek çözmez; tekrar denenebilir. */
export class ApiServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiServiceError'
  }
}

/** İsteğin kendisi hatalı (4xx). Anahtarla ilgisi yoktur, tekrar denemek anlamsızdır. */
export class ApiRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

/** Havuzdaki hiçbir anahtar çağrıyı tamamlayamadı. Mesaj son kullanıcıya gösterilebilir. */
export class ApiPoolExhaustedError extends Error {
  constructor(
    readonly provider: ApiProvider,
    readonly failures: string[],
  ) {
    super('Veri servisi şu anda kullanılamıyor. Ekibimiz bilgilendirildi, lütfen daha sonra tekrar deneyin.')
    this.name = 'ApiPoolExhaustedError'
  }
}

export interface ApiKeyRow {
  id: string
  provider: ApiProvider
  label: string
  secret: string
  is_enabled: boolean
  priority: number
  status: ApiKeyStatus
  status_message: string | null
  cooldown_until: string | null
  credit_used_usd: number | null
  credit_limit_usd: number | null
  credit_resets_at: string | null
  consecutive_failures: number
  success_count: number
  failure_count: number
  last_error: string | null
  last_used_at: string | null
  last_success_at: string | null
  last_failure_at: string | null
  last_checked_at: string | null
  created_at: string
}

/** Saatlik kontrolde bir anahtar için bulunan durum. */
export interface KeyCheckResult {
  status: ApiKeyStatus
  message: string | null
  cooldownUntil: Date | null
  creditUsedUsd?: number | null
  creditLimitUsd?: number | null
  creditResetsAt?: string | null
}

interface PoolKey {
  id: string | null
  label: string
  secret: string
}

export function getEnvApiKey(provider: ApiProvider): string | null {
  return process.env[ENV_KEY_NAMES[provider]]?.trim() || null
}

export function maskSecret(secret: string): string {
  if (secret.length <= 10) return '••••'
  return `${secret.slice(0, 6)}••••${secret.slice(-4)}`
}

export function isKeyUsable(key: Pick<ApiKeyRow, 'is_enabled' | 'status' | 'cooldown_until'>, now = Date.now()): boolean {
  if (!key.is_enabled || key.status === 'invalid') return false
  return !key.cooldown_until || new Date(key.cooldown_until).getTime() <= now
}

export async function getSystemState<T = Record<string, unknown>>(admin: SupabaseClient, key: string): Promise<T | null> {
  const { data } = await admin.from('system_state').select('value').eq('key', key).maybeSingle()
  return (data?.value as T) ?? null
}

export async function setSystemState(admin: SupabaseClient, key: string, value: Record<string, unknown>) {
  const { error } = await admin
    .from('system_state')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) console.error(`[api-keys] system_state yazılamadı (${key}):`, error.message)
}

/**
 * Havuz hiç anahtar içermiyorsa ortam değişkenindeki anahtarı bir kez havuza aktarır.
 * (Admin aktarılan anahtarı silerse tekrar aktarılmaz.)
 */
export async function importEnvKeyOnce(admin: SupabaseClient, provider: ApiProvider): Promise<boolean> {
  const envSecret = getEnvApiKey(provider)
  if (!envSecret) return false

  const flagKey = `env_key_imported:${provider}`
  if (await getSystemState(admin, flagKey)) return false

  const { error } = await admin.from('api_keys').upsert(
    {
      provider,
      label: `Ortam değişkeni (${ENV_KEY_NAMES[provider]})`,
      secret: envSecret,
      priority: 100,
    },
    { onConflict: 'provider,secret', ignoreDuplicates: true },
  )
  if (error) {
    console.error(`[api-keys] ${provider} ortam anahtarı havuza aktarılamadı:`, error.message)
    return false
  }
  await setSystemState(admin, flagKey, { imported_at: new Date().toISOString() })
  return true
}

export async function listApiKeys(admin: SupabaseClient, provider?: ApiProvider): Promise<ApiKeyRow[]> {
  let query = admin.from('api_keys').select('*').order('priority', { ascending: true }).order('created_at', { ascending: true })
  if (provider) query = query.eq('provider', provider)
  const { data, error } = await query
  if (error) throw new Error(`API anahtarları okunamadı: ${error.message}`)
  return (data ?? []) as ApiKeyRow[]
}

async function loadPoolKeys(admin: SupabaseClient | null, provider: ApiProvider): Promise<PoolKey[]> {
  const envSecret = getEnvApiKey(provider)
  const envKey: PoolKey[] = envSecret ? [{ id: null, label: ENV_KEY_NAMES[provider], secret: envSecret }] : []
  if (!admin) return envKey

  let rows: ApiKeyRow[]
  try {
    rows = await listApiKeys(admin, provider)
    if (rows.length === 0 && (await importEnvKeyOnce(admin, provider))) {
      rows = await listApiKeys(admin, provider)
    }
  } catch (error) {
    // Tablo yoksa (migration henüz çalışmadıysa) eski davranış: ortam değişkeni.
    console.error('[api-keys] Havuz okunamadı, ortam değişkenine düşülüyor:', error)
    return envKey
  }

  // Sıra: öncelik, sonra eklenme zamanı. Son çağrısı hata almış anahtarlar sona alınır.
  return rows
    .filter((row) => isKeyUsable(row))
    .sort((a, b) => Number(a.consecutive_failures > 0) - Number(b.consecutive_failures > 0))
    .map((row) => ({ id: row.id, label: row.label, secret: row.secret }))
}

async function recordResult(
  admin: SupabaseClient | null,
  key: PoolKey,
  result: { success: true } | { success: false; status: ApiKeyStatus; message: string; cooldownUntil?: Date | null },
) {
  if (!admin || !key.id) return
  const { error } = await admin.rpc('record_api_key_result', {
    p_key_id: key.id,
    p_success: result.success,
    p_status: result.success ? null : result.status,
    p_message: result.success ? null : result.message.slice(0, 500),
    p_cooldown_until: result.success ? null : result.cooldownUntil?.toISOString() ?? null,
  })
  if (error) console.error('[api-keys] Sonuç kaydedilemedi:', error.message)
}

async function notifyPoolDepleted(admin: SupabaseClient | null, provider: ApiProvider, failures: string[]) {
  try {
    const stateKey = `pool_depleted_alert:${provider}`
    if (admin) {
      const last = await getSystemState<{ sent_at?: string }>(admin, stateKey)
      if (last?.sent_at && Date.now() - new Date(last.sent_at).getTime() < POOL_DEPLETED_ALERT_INTERVAL_MS) return
      await setSystemState(admin, stateKey, { sent_at: new Date().toISOString() })
    }

    const label = PROVIDER_LABELS[provider]
    const reasons = failures.length > 0 ? failures : ['Havuzda kullanılabilir anahtar yok (hepsi pasif, geçersiz veya beklemede).']
    await sendAdminAlertEmail({
      subject: `[Influmatch] ACİL: ${label} anahtarlarının hiçbiri çalışmıyor`,
      text: [
        `${label} havuzundaki anahtarların hiçbiri isteği tamamlayamadı. Bu servise bağlı özellikler (ör. hesap doğrulama) şu anda çalışmıyor.`,
        '',
        ...reasons.map((r) => `- ${r}`),
        '',
        `Yeni anahtar eklemek için: ${adminPanelUrl('/admin/api-keys')}`,
      ].join('\n'),
    })
  } catch (error) {
    console.error('[api-keys] Acil durum uyarısı gönderilemedi:', error)
  }
}

/**
 * İşlemi havuzdaki ilk kullanılabilir anahtarla çalıştırır. Anahtar kaynaklı hatada
 * (ApiKeyError) anahtarı işaretleyip sıradakine geçer. Diğer hatalar olduğu gibi fırlatılır.
 */
export async function withApiKey<T>(provider: ApiProvider, task: (secret: string) => Promise<T>): Promise<T> {
  const admin = createSupabaseAdminClient()
  const keys = await loadPoolKeys(admin, provider)
  const failures: string[] = []

  for (const key of keys) {
    try {
      const result = await task(key.secret)
      await recordResult(admin, key, { success: true })
      return result
    } catch (error) {
      if (error instanceof ApiKeyError) {
        console.warn(`[api-keys] ${provider} anahtarı "${key.label}" devre dışı (${error.kind}): ${error.message}`)
        await recordResult(admin, key, {
          success: false,
          status: error.kind,
          message: error.message,
          cooldownUntil: error.cooldownUntil,
        })
        failures.push(`${key.label}: ${error.message}`)
        continue
      }
      if (!(error instanceof ApiRequestError)) {
        const message = error instanceof Error ? error.message : String(error)
        await recordResult(admin, key, { success: false, status: 'error', message })
      }
      throw error
    }
  }

  await notifyPoolDepleted(admin, provider, failures)
  throw new ApiPoolExhaustedError(provider, failures)
}

/** fetch hatalarını (ağ, zaman aşımı) ApiServiceError olarak sarar. */
export async function fetchExternal(url: string, init: RequestInit, serviceName: string): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: 'no-store' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new ApiServiceError(`${serviceName} bağlantı hatası: ${message}`)
  }
}
