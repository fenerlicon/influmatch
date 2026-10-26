import type { SupabaseClient } from '@supabase/supabase-js'
import { recordConsent, type ConsentSource } from '@/lib/consent'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'

/**
 * E-posta bildirim tercihleri (users.email_notifications). Web ayarlar sayfası ve mobil uç
 * (/api/mobile/email-preferences) aynı kodu kullanır; gönderimde lib/notify.ts bu tercihlere uyar.
 */
export const EMAIL_PREFERENCE_KEYS = ['offers', 'advert_applications', 'messages', 'updates', 'marketing'] as const
export type EmailPreferenceKey = (typeof EMAIL_PREFERENCE_KEYS)[number]
export type EmailPreferences = Record<EmailPreferenceKey, boolean>

/** Kolonun veritabanındaki varsayılanıyla aynı. */
export const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
  offers: true,
  advert_applications: true,
  messages: true,
  updates: true,
  marketing: false,
}

/** Gelen değeri tam ve yalnızca bilinen anahtarlardan oluşan bir nesneye çevirir; eksik anahtar varsayılanı alır. */
export function normalizeEmailPreferences(raw: unknown): EmailPreferences {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out = { ...DEFAULT_EMAIL_PREFERENCES }
  for (const key of EMAIL_PREFERENCE_KEYS) {
    if (typeof source[key] === 'boolean') out[key] = source[key] as boolean
  }
  return out
}

/** supabase: oturumdaki kullanıcının RLS'li istemcisi (web çerezi / mobil Bearer). */
export async function getEmailPreferences(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.from('users').select('email_notifications').eq('id', userId).maybeSingle()
  if (error) {
    console.error('[email-preferences] okunamadı:', error.message)
    return { error: 'Ayarlar yüklenemedi.' as const }
  }
  return { success: true as const, preferences: normalizeEmailPreferences(data?.email_notifications) }
}

export async function saveEmailPreferences(supabase: SupabaseClient, userId: string, input: unknown, source: ConsentSource = 'web') {
  const preferences = normalizeEmailPreferences(input)
  // Pazarlama izni (isteğe bağlı, varsayılan kapalı) değişirse KVKK / ETK kaydı tutulur: kim, ne zaman, verdi mi geri mi aldı.
  const { data: before } = await supabase.from('users').select('email_notifications').eq('id', userId).maybeSingle()
  const wasMarketing = normalizeEmailPreferences(before?.email_notifications).marketing
  const { error } = await supabase.from('users').update({ email_notifications: preferences }).eq('id', userId)
  if (error) {
    console.error('[email-preferences] kaydedilemedi:', error.message)
    return { error: 'Ayarlar kaydedilemedi. Lütfen tekrar deneyin.' as const }
  }
  if (before && wasMarketing !== preferences.marketing) {
    await recordConsent(createSupabaseAdminClient(), { userId, kind: 'marketing_email', granted: preferences.marketing, source })
  }
  return { success: true as const, preferences }
}
