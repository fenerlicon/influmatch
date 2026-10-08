// Fiyat kartı (yol haritası özellik 1): influencer her teslimat türü için "₺X'ten başlayan" başlangıç fiyatı
// ve "pazarlığa açık" bilgisini girer. Fiyatlar kullanıcının kendi girdiğidir; platform fiyat önermez.
//
// Görünürlük (RLS, public.rate_cards): yalnızca kartın sahibi, doğrulanmış markalar ve admin okur.
// Influencer'lar birbirinin kartını göremez. Yazım yalnızca burada, sahibin kendisi için, service role ile.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { fetchAccountRole } from '@/lib/viewer-role'
import {
  RATE_CARD_COLUMNS,
  RATE_CARD_ITEMS,
  RATE_CARD_MAX_PRICE,
  minRatePrice,
  rateCardFromRow,
  type RateCard,
  type RateCardColumn,
  type RateCardKey,
} from '@/lib/rate-card-shared'

export {
  RATE_CARD_COLUMNS,
  RATE_CARD_ITEMS,
  RATE_CARD_MAX_PRICE,
  formatTry,
  minRatePrice,
  rateCardFromRow,
  type RateCard,
  type RateCardColumn,
  type RateCardKey,
} from '@/lib/rate-card-shared'

export interface RateCardInput {
  prices?: Partial<Record<RateCardKey, unknown>> | null
  negotiable?: unknown
}

// eslint-disable-next-line @typescript-eslint/ban-types
type Result<T = {}> = ({ success: true; error?: undefined } & T) | { error: string; success?: undefined }

/** "1.500", "1500", 1500 → 1500. Boş → null. Geçersiz → NaN. */
function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isInteger(value) ? value : NaN
  if (typeof value !== 'string') return NaN
  const cleaned = value.replace(/[\s.₺]/g, '')
  if (!cleaned) return null
  return /^\d+$/.test(cleaned) ? Number(cleaned) : NaN
}

export function validateRateCardInput(input: RateCardInput): Result<{ row: Record<RateCardColumn, number | null>; negotiable: boolean; empty: boolean }> {
  const row = {} as Record<RateCardColumn, number | null>
  let filled = 0
  for (const item of RATE_CARD_ITEMS) {
    const price = parsePrice(input?.prices?.[item.key])
    if (price !== null && (!Number.isFinite(price) || price < 1 || price > RATE_CARD_MAX_PRICE)) {
      return { error: `${item.label} fiyatı 1 ile ${RATE_CARD_MAX_PRICE.toLocaleString('tr-TR')} arasında tam sayı olmalı.` }
    }
    row[item.column] = price
    if (price !== null) filled++
  }
  return { success: true, row, negotiable: input?.negotiable === true, empty: filled === 0 }
}

/** Kullanıcının kendi kartı (RLS'li kendi istemcisiyle). */
export async function getOwnRateCard(supabase: SupabaseClient, userId: string): Promise<RateCard | null> {
  const { data } = await supabase.from('rate_cards').select(RATE_CARD_COLUMNS).eq('user_id', userId).maybeSingle()
  return rateCardFromRow(data as Record<string, unknown> | null)
}

/**
 * Başka bir influencer'ın kartı. RLS yalnızca doğrulanmış marka ve admin'e satır döndürür; diğerlerine null.
 * Görüntüleyenin kendi istemcisiyle çağrılmalıdır (service role ile değil).
 */
export async function getVisibleRateCard(supabase: SupabaseClient, influencerId: string): Promise<RateCard | null> {
  const { data, error } = await supabase.from('rate_cards').select(RATE_CARD_COLUMNS).eq('user_id', influencerId).maybeSingle()
  if (error) return null
  return rateCardFromRow(data as Record<string, unknown> | null)
}

/** Görüntüleyenin görebildiği kartlardan en düşük fiyatlar (keşif filtresi). RLS dışı kartlar dönmez. */
export async function visibleMinPrices(supabase: SupabaseClient, influencerIds: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {}
  const ids = Array.from(new Set(influencerIds.filter(Boolean)))
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from('rate_cards').select(RATE_CARD_COLUMNS).in('user_id', ids.slice(i, i + 100))
    if (error) {
      console.error('[rate-card] fiyatlar alınamadı:', error.message)
      break
    }
    for (const row of data ?? []) {
      const min = minRatePrice(rateCardFromRow(row as Record<string, unknown>))
      if (min !== null) result[row.user_id as string] = min
    }
  }
  return result
}

/** Influencer kendi kartını kaydeder; tüm fiyatlar boşsa kart silinir. */
export async function saveRateCardAs(supabase: SupabaseClient, userId: string, input: RateCardInput): Promise<Result<{ rateCard: RateCard | null }>> {
  if ((await fetchAccountRole(supabase, userId)) !== 'influencer') {
    return { error: 'Fiyat kartını yalnızca influencer/UGC hesapları düzenleyebilir.' }
  }
  const checked = validateRateCardInput(input)
  if (!checked.success) return { error: checked.error }

  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sunucu yapılandırması eksik. Lütfen daha sonra tekrar deneyin.' }

  if (checked.empty) {
    const { error } = await admin.from('rate_cards').delete().eq('user_id', userId)
    if (error) {
      console.error('[rate-card] silme hatası:', error.message)
      return { error: 'Fiyat kartı kaydedilemedi. Lütfen tekrar deneyin.' }
    }
    return { success: true, rateCard: null }
  }

  const { data, error } = await admin
    .from('rate_cards')
    .upsert({ user_id: userId, ...checked.row, negotiable: checked.negotiable, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select(RATE_CARD_COLUMNS)
    .single()
  if (error) {
    console.error('[rate-card] kayıt hatası:', error.message)
    return { error: 'Fiyat kartı kaydedilemedi. Lütfen tekrar deneyin.' }
  }
  return { success: true, rateCard: rateCardFromRow(data as Record<string, unknown>) }
}
