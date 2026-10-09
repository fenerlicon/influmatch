// Platform ayarları (public.platform_settings, anahtar/değer). Tablo istemci rollerine tamamen kapalıdır;
// yalnızca sunucu service role ile okur, admin paneli (/admin/limits) yazar.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.
// Okuma hatasında varsayılanlar döner; varsayılanda bayrak KAPALI olduğu için davranış bugünküyle aynı kalır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import {
  DEFAULT_PLATFORM_SETTINGS,
  PLATFORM_SETTING_KEYS,
  normalizePlatformSettings,
  type PlatformSettings,
} from '@/lib/platform-settings-shared'

export type { PlatformSettings }

export async function loadPlatformSettings(admin?: SupabaseClient | null): Promise<PlatformSettings> {
  const client = admin ?? createSupabaseAdminClient()
  if (!client) return { ...DEFAULT_PLATFORM_SETTINGS }
  const { data, error } = await client.from('platform_settings').select('key, value').in('key', [...PLATFORM_SETTING_KEYS])
  if (error) {
    console.error('[platform-settings] okunamadı:', error.message)
    return { ...DEFAULT_PLATFORM_SETTINGS }
  }
  const raw: Record<string, unknown> = {}
  for (const row of data ?? []) raw[row.key as string] = row.value
  return normalizePlatformSettings(raw)
}

/** Ayarları yazar (yalnızca admin aksiyonundan, rol kontrolünden sonra çağrılır). */
export async function savePlatformSettings(admin: SupabaseClient, adminUserId: string, settings: PlatformSettings) {
  const now = new Date().toISOString()
  const rows = PLATFORM_SETTING_KEYS.map((key) => ({ key, value: settings[key], updated_at: now, updated_by: adminUserId }))
  const { error } = await admin.from('platform_settings').upsert(rows, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}
