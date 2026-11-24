// Telefon numarası (2026-11-24, kullanıcı kararı): influencer, UGC ve marka için zorunlu; acil durumda yalnızca platform ulaşır.
// Tablo `user_contacts` istemcilere tamamen kapalı (RLS + REVOKE); okuma / yazma burada service role ile.
//   - Kullanıcı kendi numarasını onboarding'de, panel kapısında (/onboarding/phone) ya da Ayarlar'da girer / değiştirir.
//   - Admin kullanıcı ayrıntısında "Telefonu göster" ile görür; her görüntüleme privacy_audit_log'a yazılır (contact_view).
//   - Pazarlama izni (SMS / arama) ayrı ve isteğe bağlı: tabloda bayrak + consent_records 'marketing_sms' geçmişi.
//     Not: ticari SMS / arama göndermeden önce İYS kaydı ve avukat onaylı aydınlatma metni gerekir (docs/KVKK.md).
//   - SMS doğrulaması yok (phone_verified_at boş); sağlayıcı seçilince eklenir.
// Kural 1: numara hiçbir dış servise gönderilmez.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { recordConsent, isMissingTableError, type ConsentSource } from '@/lib/consent'
import { logPrivacyAccess } from '@/lib/privacy-audit'
import { normalizePhone } from '@/lib/phone-shared'

export interface OwnContact {
  phone: string
  marketingSms: boolean
  verified: boolean
}

/** Kullanıcının kendi numarası; yoksa null. Tablo yoksa (SQL uygulanmadı) `undefined` (kapı uygulanmaz). */
export async function getOwnContact(userId: string, admin: SupabaseClient | null = createSupabaseAdminClient()): Promise<OwnContact | null | undefined> {
  if (!admin) return undefined
  const { data, error } = await admin.from('user_contacts').select('phone, marketing_sms, phone_verified_at').eq('user_id', userId).maybeSingle()
  if (error) {
    if (!isMissingTableError(error)) console.error('[user-contact] okunamadı:', error.message)
    return undefined
  }
  if (!data) return null
  return { phone: data.phone as string, marketingSms: !!data.marketing_sms, verified: !!data.phone_verified_at }
}

/** Panel kapısı: rolü influencer / marka olup numarası olmayan kullanıcı. Okuma hatasında kapı uygulanmaz. */
export async function needsPhone(userId: string, role: string | null | undefined, admin?: SupabaseClient | null): Promise<boolean> {
  if (role !== 'influencer' && role !== 'brand') return false
  return (await getOwnContact(userId, admin ?? createSupabaseAdminClient())) === null
}

/**
 * Kendi numarasını kaydeder / değiştirir. `marketingSms` verilirse izin de güncellenir ve rıza geçmişine yazılır
 * (yalnızca değiştiyse). Numara değişince doğrulama işareti sıfırlanır.
 */
export async function saveOwnContact(
  userId: string,
  input: { phone: unknown; marketingSms?: unknown },
  source: ConsentSource,
): Promise<{ success: true; phone: string } | { success: false; error: string }> {
  const checked = normalizePhone(input.phone)
  if ('error' in checked) return { success: false, error: checked.error }
  const admin = createSupabaseAdminClient()
  if (!admin) return { success: false, error: 'Sistem yapılandırma hatası.' }

  const previous = await getOwnContact(userId, admin)
  const now = new Date().toISOString()
  const marketing = typeof input.marketingSms === 'boolean' ? input.marketingSms : previous?.marketingSms ?? false
  const row: Record<string, unknown> = { user_id: userId, phone: checked.phone, marketing_sms: marketing, updated_at: now }
  if (!previous || previous.phone !== checked.phone) row.phone_verified_at = null
  const { error } = await admin.from('user_contacts').upsert(row, { onConflict: 'user_id' })
  if (error) {
    console.error('[user-contact] kaydedilemedi:', error.message)
    return { success: false, error: 'Telefon numarası kaydedilemedi. Lütfen tekrar deneyin.' }
  }
  if (typeof input.marketingSms === 'boolean' && (previous?.marketingSms ?? null) !== input.marketingSms) {
    await recordConsent(admin, { userId, kind: 'marketing_sms', granted: input.marketingSms, source })
  }
  return { success: true, phone: checked.phone }
}

/** Admin: kullanıcının numarası (her görüntüleme günlüğe yazılır). */
export async function adminViewContact(adminUserId: string, userId: string): Promise<{ success: true; phone: string | null; marketingSms: boolean } | { success: false; error: string }> {
  const admin = createSupabaseAdminClient()
  if (!admin) return { success: false, error: 'Sistem yapılandırma hatası.' }
  const { data: me } = await admin.from('users').select('role').eq('id', adminUserId).maybeSingle()
  if (me?.role !== 'admin') return { success: false, error: 'Bu işlem için yetkiniz yok.' }
  const contact = await getOwnContact(userId, admin)
  await logPrivacyAccess(admin, { actorId: adminUserId, action: 'contact_view', subjectUserId: userId, resourceId: `user_contacts/${userId}` })
  return { success: true, phone: contact?.phone ?? null, marketingSms: !!contact?.marketingSms }
}
