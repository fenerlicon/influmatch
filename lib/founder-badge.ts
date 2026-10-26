// Kurucu Üye rozeti: verme, saatlik tarama ve son tarih ayarı (kural: lib/founder-badge-shared.ts).
// - Hesap onaylanınca (utils/badgeAwarding.ts → awardFounderBadgeIfEligible) ve saatlik görevde (sweepFounderBadges) verilir.
// - Son tarih geçtikten sonra yeni rozet verilmez; verilmiş rozet asla geri alınmaz (bu modülde silme yok).
// - Kullanıcıya bir kez site içi bildirim + push gider (e-posta yok: 'badge_change' olayı e-postasız).
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/notify'
import {
  FOUNDER_BADGE_ID,
  FOUNDER_BADGE_ROLES,
  FOUNDER_CUTOFF_KEY,
  founderNoticeLink,
  founderWindowOpen,
  normalizeFounderCutoff,
} from '@/lib/founder-badge-shared'

export type FounderCutoffRead = { ok: true; cutoff: string | null } | { ok: false }

/** Son tarihi okur. Okuma hatasında ok:false döner; çağıran rozet vermez (son tarihten sonra verilmesin). */
export async function loadFounderCutoff(admin: SupabaseClient): Promise<FounderCutoffRead> {
  const { data, error } = await admin.from('platform_settings').select('value').eq('key', FOUNDER_CUTOFF_KEY).maybeSingle()
  if (error) {
    console.error('[founder-badge] son tarih okunamadı:', error.message)
    return { ok: false }
  }
  return { ok: true, cutoff: normalizeFounderCutoff(data?.value) }
}

export async function saveFounderCutoff(admin: SupabaseClient, adminUserId: string, cutoff: string | null) {
  const { error } = await admin
    .from('platform_settings')
    .upsert(
      { key: FOUNDER_CUTOFF_KEY, value: cutoff, updated_at: new Date().toISOString(), updated_by: adminUserId },
      { onConflict: 'key' },
    )
  if (error) throw new Error(error.message)
}

const FOUNDER_NOTICE_TITLE = 'Kurucu Üye rozetin verildi'
const NOTICE_LINKS = [founderNoticeLink('influencer'), founderNoticeLink('brand')]

async function notifyFounders(admin: SupabaseClient, users: Array<{ id: string; role: string }>) {
  if (!users.length) return
  // Bir kez: daha önce aynı rozet bildirimini almış olan (ör. rozeti kendisi silip yeniden alan) tekrar bildirilmez.
  const ids = users.map((u) => u.id)
  const { data: previous } = await admin
    .from('notifications')
    .select('user_id')
    .in('user_id', ids)
    .in('link', NOTICE_LINKS)
    .eq('title', FOUNDER_NOTICE_TITLE)
  const already = new Set(((previous ?? []) as Array<{ user_id: string }>).map((row) => row.user_id))
  const pending = users.filter((u) => !already.has(u.id))
  for (let i = 0; i < pending.length; i += 5) {
    await Promise.all(
      pending.slice(i, i + 5).map((u) =>
        notifyUser(
          {
            userId: u.id,
            event: 'badge_change',
            title: FOUNDER_NOTICE_TITLE,
            message: '0₺ kampanyasından önce Influmatch’e katılan doğrulanmış üyelerdensin. Rozet profilinde kalıcı olarak yer alır; Rozetler sayfasından vitrine ekleyebilirsin.',
            link: founderNoticeLink(u.role),
            type: 'success',
          },
          admin,
        ),
      ),
    )
  }
}

/** Verilen kullanıcılara rozeti ekler (zaten sahip olanlara dokunmaz) ve yeni alanlara bildirim gönderir. Yeni verilen sayısı döner. */
async function grantFounderBadge(admin: SupabaseClient, users: Array<{ id: string; role: string }>): Promise<number> {
  if (!users.length) return 0
  const ids = users.map((u) => u.id)
  const { data: holders, error: holderError } = await admin
    .from('user_badges')
    .select('user_id')
    .eq('badge_id', FOUNDER_BADGE_ID)
    .in('user_id', ids)
  if (holderError) throw new Error(`Kurucu Üye sahipleri okunamadı: ${holderError.message}`)
  const held = new Set(((holders ?? []) as Array<{ user_id: string }>).map((row) => row.user_id))
  const fresh = users.filter((u) => !held.has(u.id))
  if (!fresh.length) return 0

  const now = new Date().toISOString()
  const { error } = await admin
    .from('user_badges')
    .upsert(
      fresh.map((u) => ({ user_id: u.id, badge_id: FOUNDER_BADGE_ID, earned_at: now })),
      { onConflict: 'user_id,badge_id', ignoreDuplicates: true },
    )
  if (error) throw new Error(`Kurucu Üye rozeti verilemedi: ${error.message}`)

  await notifyFounders(admin, fresh)
  return fresh.length
}

/** Hesap onaylandığında çağrılır: kullanıcı doğrulanmışsa ve son tarih geçmediyse rozeti verir. Hata fırlatmaz. */
export async function awardFounderBadgeIfEligible(admin: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const cutoff = await loadFounderCutoff(admin)
    if (!cutoff.ok || !founderWindowOpen(cutoff.cutoff)) return false
    const { data: user } = await admin.from('users').select('id, role, verification_status').eq('id', userId).maybeSingle()
    if (!user || user.verification_status !== 'verified') return false
    if (!(FOUNDER_BADGE_ROLES as readonly string[]).includes(user.role as string)) return false
    return (await grantFounderBadge(admin, [{ id: user.id as string, role: user.role as string }])) > 0
  } catch (error) {
    console.error('[founder-badge] verilemedi:', error)
    return false
  }
}

export interface FounderSweepSummary {
  open: boolean
  cutoff: string | null
  granted: number
  remaining: number
}

/**
 * Saatlik görev ve admin "Şimdi tara": son tarih geçmediyse doğrulanmış olup rozeti olmayanlara verir.
 * İlk çalıştırmada çok kişi olabileceği için tur başına `limit` kişi; kalanlar sonraki turda. Geri alma yok.
 */
export async function sweepFounderBadges(
  admin: SupabaseClient,
  options: { limit?: number; deadline?: number } = {},
): Promise<FounderSweepSummary> {
  const limit = options.limit ?? 100
  const cutoff = await loadFounderCutoff(admin)
  if (!cutoff.ok) throw new Error('Kurucu Üye son tarihi okunamadı.')
  if (!founderWindowOpen(cutoff.cutoff)) return { open: false, cutoff: cutoff.cutoff, granted: 0, remaining: 0 }

  const verified: Array<{ id: string; role: string }> = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from('users')
      .select('id, role')
      .eq('verification_status', 'verified')
      .in('role', [...FOUNDER_BADGE_ROLES])
      .order('id')
      .range(from, from + 999)
    if (error) throw new Error(`Doğrulanmış hesaplar okunamadı: ${error.message}`)
    verified.push(...((data ?? []) as Array<{ id: string; role: string }>))
    if (!data || data.length < 1000) break
  }

  const held = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from('user_badges')
      .select('user_id')
      .eq('badge_id', FOUNDER_BADGE_ID)
      .order('user_id')
      .range(from, from + 999)
    if (error) throw new Error(`Kurucu Üye sahipleri okunamadı: ${error.message}`)
    for (const row of (data ?? []) as Array<{ user_id: string }>) held.add(row.user_id)
    if (!data || data.length < 1000) break
  }

  const missing = verified.filter((u) => !held.has(u.id))
  let granted = 0
  let index = 0
  while (index < missing.length && granted < limit) {
    if (options.deadline && Date.now() > options.deadline) break
    const batch = missing.slice(index, index + Math.min(25, limit - granted))
    index += batch.length
    granted += await grantFounderBadge(admin, batch)
  }
  return { open: true, cutoff: cutoff.cutoff, granted, remaining: Math.max(0, missing.length - index) }
}
