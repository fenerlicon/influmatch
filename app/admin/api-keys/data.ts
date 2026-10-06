// Admin API anahtarları ekranının veri katmanı (sunucu tarafı).
// Anahtarların kendisi (secret) asla istemciye gönderilmez; sadece maskeli hali gider.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getEnvApiKey, getSystemState, listApiKeys, maskSecret, type ApiKeyRow, type ApiProvider } from '@/lib/api-keys'
import { LAST_RUN_STATE_KEY } from '@/lib/api-key-health'
import { isAlertEmailConfigured, resolveAlertRecipients } from '@/lib/email'
import { getGeminiModel } from '@/lib/gemini'

export type ApiKeyView = Omit<ApiKeyRow, 'secret'> & { masked: string }

export interface ApiKeyDashboard {
  keys: ApiKeyView[]
  lastRun: { ran_at: string; has_problems: boolean; email_sent: boolean; email_error: string | null } | null
  email: { configured: boolean; recipients: string[] }
  envKeys: Record<ApiProvider, boolean>
  geminiModel: string
  loadError: string | null
}

export function toApiKeyView({ secret, ...rest }: ApiKeyRow): ApiKeyView {
  return { ...rest, masked: maskSecret(secret) }
}

export async function loadApiKeyDashboard(admin: SupabaseClient): Promise<ApiKeyDashboard> {
  let keys: ApiKeyView[] = []
  let loadError: string | null = null
  try {
    keys = (await listApiKeys(admin)).map(toApiKeyView)
  } catch (error) {
    loadError = `${error instanceof Error ? error.message : String(error)} (20261006000001_api_key_pool.sql migration çalıştırıldı mı?)`
  }

  return {
    keys,
    lastRun: loadError ? null : await getSystemState<ApiKeyDashboard['lastRun'] & object>(admin, LAST_RUN_STATE_KEY),
    email: { configured: isAlertEmailConfigured(), recipients: await resolveAlertRecipients() },
    envKeys: { apify: !!getEnvApiKey('apify'), gemini: !!getEnvApiKey('gemini') },
    geminiModel: getGeminiModel(),
    loadError,
  }
}
