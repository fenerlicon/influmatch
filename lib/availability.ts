// Müsaitlik yazımı ve okuması (SYSTEM_MAP 3.19). Web ayar aksiyonu ve mobil /api/mobile/availability aynı kodu çağırır.
// Kolonlar users_before_update_guard beyaz listesinde değil: istemci oturumu bu kolonları yazamaz (sessizce düşer).
// Yazım burada, yalnızca influencer/UGC kendi satırı için, doğrulamadan sonra service role ile yapılır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { fetchAccountRole } from '@/lib/viewer-role'
import {
  AVAILABILITY_COLUMNS,
  AVAILABILITY_MAX_DAYS,
  AVAILABILITY_NOTE_MAX,
  effectiveAvailability,
  istanbulToday,
  type Availability,
} from '@/lib/availability-shared'

export * from '@/lib/availability-shared'

export interface AvailabilityInput {
  status?: unknown
  note?: unknown
  until?: unknown
}

/** Oturum sahibinin kendi müsaitliği (RLS'li kendi istemcisiyle; kolon SELECT yetkisi var). */
export async function getOwnAvailability(supabase: SupabaseClient, userId: string): Promise<Availability> {
  const { data } = await supabase.from('users').select(AVAILABILITY_COLUMNS).eq('id', userId).maybeSingle()
  return effectiveAvailability(data as Record<string, string | null> | null)
}

export function validateAvailabilityInput(input: AvailabilityInput): { value: Availability } | { error: string } {
  if (!input || typeof input !== 'object') return { error: 'Geçersiz istek.' }
  const status = input.status === 'busy' ? 'busy' : input.status === 'open' ? 'open' : null
  if (!status) return { error: 'Durumu seçin.' }
  if (status === 'open') return { value: { status, note: null, until: null } }

  const note = typeof input.note === 'string' ? input.note.trim() : ''
  if (note.length > AVAILABILITY_NOTE_MAX) return { error: `Not en fazla ${AVAILABILITY_NOTE_MAX} karakter olabilir.` }

  let until: string | null = null
  if (input.until !== null && input.until !== undefined && input.until !== '') {
    if (typeof input.until !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.until)) return { error: 'Tarih geçersiz.' }
    const d = new Date(`${input.until}T00:00:00Z`)
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== input.until) return { error: 'Tarih geçersiz.' }
    const today = istanbulToday()
    const max = new Date(new Date(`${today}T00:00:00Z`).getTime() + AVAILABILITY_MAX_DAYS * 86_400_000).toISOString().slice(0, 10)
    if (input.until < today) return { error: 'Bitiş tarihi bugünden önce olamaz.' }
    if (input.until > max) return { error: 'Bitiş tarihi en fazla bir yıl sonrası olabilir.' }
    until = input.until
  }
  return { value: { status, note: note || null, until } }
}

/** Influencer/UGC kendi müsaitliğini kaydeder. */
export async function setAvailabilityAs(
  supabase: SupabaseClient,
  userId: string,
  input: AvailabilityInput,
): Promise<{ success: true; availability: Availability } | { error: string }> {
  if ((await fetchAccountRole(supabase, userId)) !== 'influencer') {
    return { error: 'Müsaitlik durumu yalnızca influencer/UGC hesaplarında kullanılır.' }
  }
  const checked = validateAvailabilityInput(input)
  if ('error' in checked) return checked
  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sunucu yapılandırması eksik. Lütfen daha sonra tekrar deneyin.' }
  const { value } = checked
  const { error } = await admin
    .from('users')
    .update({
      availability_status: value.status,
      availability_note: value.note,
      availability_until: value.until,
      availability_updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .eq('role', 'influencer')
  if (error) {
    console.error('[availability] kayıt hatası:', error.message)
    return { error: 'Kaydedilemedi. Lütfen tekrar deneyin.' }
  }
  return { success: true, availability: value }
}

/** Saatlik görev: bitiş tarihi geçmiş "dolu" durumlarını temizler (okuma zaten geçmiş tarihi "iş alıyorum" sayar). */
export async function resetExpiredAvailability(admin: SupabaseClient) {
  const { data, error } = await admin
    .from('users')
    .update({ availability_status: 'open', availability_note: null, availability_until: null, availability_updated_at: new Date().toISOString() })
    .eq('availability_status', 'busy')
    .lt('availability_until', istanbulToday())
    .select('id')
  if (error) throw new Error(error.message)
  return { reset: data?.length ?? 0 }
}
