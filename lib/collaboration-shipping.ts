// Barter teslimat adresi (2026-11-24, kullanıcı kararı). Influencer barter iş birliğinde adresini girer; marka adresi yalnızca
// anlaşma özeti iki tarafça onaylandıktan sonra görür. Tablo `collaboration_shipping` istemcilere kapalı; okuma / yazma burada
// service role ile, taraf + kural kontrolünden sonra. Web aksiyonu ve mobil uç (/api/mobile/collaborations/[id]/shipping) ortak.
// Kural 1: adres hiçbir dış servise gönderilmez.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { displayNameOf, notifyUser } from '@/lib/notify'
import { isMissingTableError } from '@/lib/consent'
import { normalizePhone } from '@/lib/phone-shared'
import { SHIPPING_LIMITS, type ShippingAddress, type ShippingView } from '@/lib/collaboration-shipping-shared'

const COLUMNS = 'recipient_name, phone, address_line, district, city, postal_code, note'
const ACTIVE_STATUSES = ['agreed', 'in_progress', 'published']

interface CollabLite {
  id: string
  brand_id: string
  influencer_id: string
  title: string
  status: string
}

interface AgreementLite {
  payment_type: string
  brand_confirmed_at: string | null
  influencer_confirmed_at: string | null
}

const clean = (raw: unknown, max: number) => (typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, max) : '')

export function validateShipping(input: Record<string, unknown> | null | undefined): { value: ShippingAddress } | { error: string } {
  const i = input ?? {}
  const recipient = clean(i.recipient_name, SHIPPING_LIMITS.recipientMax)
  if (recipient.length < 2) return { error: 'Alıcı adını girin.' }
  const phone = normalizePhone(i.phone)
  if ('error' in phone) return { error: phone.error }
  const address = clean(i.address_line, SHIPPING_LIMITS.addressMax)
  if (address.length < 5) return { error: 'Açık adresi girin (mahalle, cadde / sokak, no, daire).' }
  const district = clean(i.district, SHIPPING_LIMITS.districtMax)
  if (district.length < 2) return { error: 'İlçeyi girin.' }
  const city = clean(i.city, SHIPPING_LIMITS.cityMax)
  if (city.length < 2) return { error: 'İli girin.' }
  const postal = clean(i.postal_code, 5)
  if (postal && !/^\d{5}$/.test(postal)) return { error: 'Posta kodu 5 haneli olmalı.' }
  const note = clean(i.note, SHIPPING_LIMITS.noteMax)
  return {
    value: { recipient_name: recipient, phone: phone.phone, address_line: address, district, city, postal_code: postal || null, note: note || null },
  }
}

/** Workspace görünümü (taraf kontrolü çağıranda yapılmış olmalı). */
export async function shippingViewFor(
  collab: Pick<CollabLite, 'id' | 'brand_id' | 'influencer_id' | 'status'>,
  viewerId: string,
  agreement: AgreementLite | null,
  admin: SupabaseClient | null = createSupabaseAdminClient(),
): Promise<ShippingView | null> {
  if (!admin || !agreement || agreement.payment_type !== 'barter') return null
  const isBrand = collab.brand_id === viewerId
  const confirmed = !!agreement.brand_confirmed_at && !!agreement.influencer_confirmed_at
  if (isBrand && !confirmed) return { needed: true, address: null, suggested: false, canEdit: false, lockedForBrand: true }

  const { data, error } = await admin.from('collaboration_shipping').select(COLUMNS).eq('collaboration_id', collab.id).maybeSingle()
  if (error) {
    if (!isMissingTableError(error)) console.error('[shipping] okunamadı:', error.message)
    return null
  }
  if (isBrand) return { needed: true, address: (data as ShippingAddress | null) ?? null, suggested: false, canEdit: false, lockedForBrand: false }

  const canEdit = ACTIVE_STATUSES.includes(collab.status)
  if (data) return { needed: true, address: data as ShippingAddress, suggested: false, canEdit, lockedForBrand: false }
  // Öneri: influencer'ın en son girdiği adres (yeniden yazmasın diye; kaydetmeden markaya görünmez).
  const { data: last } = await admin
    .from('collaboration_shipping')
    .select(COLUMNS)
    .eq('influencer_id', viewerId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return { needed: true, address: (last as ShippingAddress | null) ?? null, suggested: !!last, canEdit, lockedForBrand: false }
}

/** Influencer adresini kaydeder / günceller. Anlaşma onaylıysa markaya bildirim gider. */
export async function saveShippingAs(userId: string, collaborationId: string, input: unknown): Promise<{ success: true; message: string } | { success?: undefined; error: string }> {
  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sistem yapılandırma hatası.' }
  if (!/^[0-9a-f-]{36}$/i.test(collaborationId)) return { error: 'İş birliği bulunamadı.' }
  const { data: collab } = await admin.from('collaborations').select('id, brand_id, influencer_id, title, status').eq('id', collaborationId).maybeSingle()
  const c = collab as CollabLite | null
  if (!c || (c.brand_id !== userId && c.influencer_id !== userId)) return { error: 'İş birliği bulunamadı.' }
  if (c.influencer_id !== userId) return { error: 'Teslimat adresini yalnızca influencer girer.' }
  if (!ACTIVE_STATUSES.includes(c.status)) return { error: 'Bu iş birliğinde adres artık değiştirilemez.' }
  const { data: agreement } = await admin
    .from('collaboration_agreements')
    .select('payment_type, brand_confirmed_at, influencer_confirmed_at')
    .eq('collaboration_id', c.id)
    .maybeSingle()
  const a = agreement as AgreementLite | null
  if (!a || a.payment_type !== 'barter') return { error: 'Teslimat adresi yalnızca barter iş birliklerinde istenir.' }

  const checked = validateShipping(input as Record<string, unknown>)
  if ('error' in checked) return { error: checked.error }
  const now = new Date().toISOString()
  const { error } = await admin
    .from('collaboration_shipping')
    .upsert({ collaboration_id: c.id, influencer_id: userId, ...checked.value, updated_at: now }, { onConflict: 'collaboration_id' })
  if (error) {
    console.error('[shipping] kaydedilemedi:', error.message)
    return { error: 'Adres kaydedilemedi. Lütfen tekrar deneyin.' }
  }
  if (a.brand_confirmed_at && a.influencer_confirmed_at) {
    const name = await displayNameOf(admin, userId)
    await notifyUser(
      {
        userId: c.brand_id,
        event: 'collab_shipping',
        title: 'Teslimat adresi eklendi',
        message: `${name}, "${c.title}" iş birliği için ürünün gönderileceği adresi ekledi.`,
        link: `/dashboard/collaborations/${c.id}`,
      },
      admin,
    )
  }
  return { success: true, message: 'Teslimat adresi kaydedildi.' }
}
