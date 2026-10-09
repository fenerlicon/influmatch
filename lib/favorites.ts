// Favoriler ve listeler (Inflist) — web server action'ları ve mobil /api/mobile/favorites aynı kodu kullanır.
// 2026-10-10 kararı: ücretsiz markada favori ve liste yok, yalnızca Spotlight (Basic / Pro) markalarda.
// Kilit ücretsiz marka sınırlarıyla AYNI bayrağa bağlıdır (free_brand_limits_enabled). Bayrak kapalıyken davranış
// bugünküyle aynıdır. Kayıtlı favoriler ve listeler silinmez; kilitliyken gizlenir ve değiştirilemez, marka Spotlight
// alınca geri gelir. DB yedeği: enforce_brand_favorites_lock tetikleyicileri (migration 20261010000030).
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getBrandLimitContext, type BrandLimitContext } from '@/lib/brand-limits'
import { FAVORITES_LOCKED_ERROR } from '@/lib/favorites-shared'

export { FAVORITES_LOCKED_ERROR }

/** Bayrak açık ve marka ücretsizse true (favoriler / listeler kilitli). */
export async function areFavoritesLocked(userId: string, ctx?: BrandLimitContext): Promise<boolean> {
  const context = ctx ?? (await getBrandLimitContext(userId))
  return context.active && context.plan === 'free'
}

/** DB tetikleyicisinin (yedek kontrol) hata metnini kullanıcı mesajına çevirir. */
export function favoritesLockErrorFromDb(message: string | null | undefined): string | null {
  if (message && message.includes('brand_limit:favorites')) return FAVORITES_LOCKED_ERROR
  return null
}

type Result<T> = { error: string } | (T & { error?: undefined })

async function brandRow(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from('users').select('role, verification_status').eq('id', userId).maybeSingle()
  return data as { role: string | null; verification_status: string | null } | null
}

/** Markanın favori profil kimlikleri; kilitliyse boş liste ve locked: true. */
export async function listFavoriteIdsAs(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ locked: boolean; ids: string[] }> {
  if (await areFavoritesLocked(userId)) return { locked: true, ids: [] }
  const { data, error } = await supabase.from('favorites').select('influencer_id').eq('brand_id', userId)
  if (error) throw new Error(error.message)
  return { locked: false, ids: (data ?? []).map((row: { influencer_id: string }) => row.influencer_id) }
}

/** Favoriye ekler ya da çıkarır. */
export async function toggleFavoriteAs(
  supabase: SupabaseClient,
  userId: string,
  influencerId: string,
): Promise<Result<{ isFavorited: boolean }>> {
  if (typeof influencerId !== 'string' || !influencerId) return { error: 'Geçersiz profil.' }

  const profile = await brandRow(supabase, userId)
  if (!profile || profile.role !== 'brand') return { error: 'Sadece markalar favorilere ekleme yapabilir.' }
  if (await areFavoritesLocked(userId)) return { error: FAVORITES_LOCKED_ERROR }

  // Tüm eşleşen satırlar okunur: .single() birden fazla satırda hata verip kaydı "yok" sanıyor
  // ve yeni bir kopya ekliyordu (çift tıklama vb.).
  const { data: existing, error: checkError } = await supabase
    .from('favorites')
    .select('id')
    .eq('brand_id', userId)
    .eq('influencer_id', influencerId)
  if (checkError) return { error: checkError.message }

  if (existing && existing.length > 0) {
    const { error } = await supabase.from('favorites').delete().eq('brand_id', userId).eq('influencer_id', influencerId)
    if (error) return { error: favoritesLockErrorFromDb(error.message) ?? error.message }
    return { isFavorited: false }
  }

  const { error } = await supabase.from('favorites').insert({ brand_id: userId, influencer_id: influencerId })
  // 23505: aynı anda gelen ikinci istek; kayıt zaten var.
  if (error && error.code !== '23505') return { error: favoritesLockErrorFromDb(error.message) ?? error.message }
  return { isFavorited: true }
}

const LIST_NAME_MAX = 50

/** Liste yazımları için ortak kontrol: doğrulanmış marka + kilit. Sorun yoksa null. */
async function listWriteError(supabase: SupabaseClient, userId: string, action: 'create' | 'item'): Promise<string | null> {
  const profile = await brandRow(supabase, userId)
  if (!profile || profile.role !== 'brand') {
    return action === 'create' ? 'Sadece markalar liste oluşturabilir.' : 'Sadece markalar bu işlemi yapabilir.'
  }
  if (profile.verification_status !== 'verified') {
    return action === 'create'
      ? 'Liste oluşturabilmek için hesabınızın doğrulanmış olması gerekmektedir.'
      : 'Influencerları listeye eklemek için hesabınızın doğrulanmış olması gerekmektedir.'
  }
  if (await areFavoritesLocked(userId)) return FAVORITES_LOCKED_ERROR
  return null
}

export async function createListAs(
  supabase: SupabaseClient,
  userId: string,
  name: string,
): Promise<Result<{ data: { id: string; name: string } }>> {
  const trimmedName = typeof name === 'string' ? name.trim() : ''
  if (!trimmedName) return { error: 'Liste adı boş olamaz.' }
  if (trimmedName.length > LIST_NAME_MAX) return { error: `Liste adı en fazla ${LIST_NAME_MAX} karakter olabilir.` }

  const blocked = await listWriteError(supabase, userId, 'create')
  if (blocked) return { error: blocked }

  const { data, error } = await supabase
    .from('favorite_lists')
    .insert({ brand_id: userId, name: trimmedName })
    .select('id, name')
    .single()
  if (error || !data) {
    console.error('[createList] error:', error)
    return { error: favoritesLockErrorFromDb(error?.message) ?? 'Liste oluşturulamadı.' }
  }
  return { data: data as { id: string; name: string } }
}

export async function deleteListAs(supabase: SupabaseClient, userId: string, listId: string): Promise<Result<{ success: true }>> {
  if (await areFavoritesLocked(userId)) return { error: FAVORITES_LOCKED_ERROR }
  const { error } = await supabase.from('favorite_lists').delete().eq('id', listId).eq('brand_id', userId)
  if (error) {
    console.error('[deleteList] error:', error)
    return { error: favoritesLockErrorFromDb(error.message) ?? 'Liste silinemedi.' }
  }
  return { success: true }
}

export async function toggleInListAs(
  supabase: SupabaseClient,
  userId: string,
  listId: string,
  influencerId: string,
): Promise<Result<{ added: boolean }>> {
  const blocked = await listWriteError(supabase, userId, 'item')
  if (blocked) return { error: blocked }

  const { data: existing } = await supabase
    .from('favorite_list_items')
    .select('id')
    .eq('list_id', listId)
    .eq('influencer_id', influencerId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('favorite_list_items').delete().eq('id', existing.id)
    if (error) {
      console.error('[toggleInList] delete error:', error)
      return { error: favoritesLockErrorFromDb(error.message) ?? 'Listeden çıkarılamadı.' }
    }
    return { added: false }
  }

  const { error } = await supabase.from('favorite_list_items').insert({ list_id: listId, influencer_id: influencerId })
  if (error) {
    console.error('[toggleInList] insert error:', error)
    return { error: favoritesLockErrorFromDb(error.message) ?? 'Listeye eklenemedi.' }
  }
  return { added: true }
}
