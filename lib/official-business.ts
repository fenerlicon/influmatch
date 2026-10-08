// "Resmi İşletme" (sarı tik, official-business rozeti) için tek karar noktası.
//
// Sarı tik = vergi numarası onaylı (tax_id_verified) + şirket alan adına ait kurumsal e-posta
// kodla doğrulanmış + e-postanın alan adı hâlâ web sitesinin alan adı.
// Bu koşullardan biri değiştiğinde syncOfficialBusiness çağrılır; rozet verilir veya geri alınır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { registrableDomain, websiteHost, emailDomain } from '@/lib/corporate-email'
import { notifyUser } from '@/lib/notify'

export const OFFICIAL_BADGE = 'official-business'
const MAX_DISPLAYED_BADGES = 3

export interface OfficialBusinessState {
  taxVerified: boolean
  corporateEmail: string | null
  corporateEmailVerified: boolean
  domainMatches: boolean
  eligible: boolean
}

export function evaluateOfficialBusiness(row: {
  tax_id_verified: boolean | null
  corporate_email: string | null
  corporate_email_verified_at: string | null
  social_links: Record<string, string | null> | null
}): OfficialBusinessState {
  const host = websiteHost(row.social_links?.website)
  const domain = row.corporate_email ? emailDomain(row.corporate_email) : null
  const domainMatches = !!host && !!domain && registrableDomain(host) === registrableDomain(domain)
  const taxVerified = row.tax_id_verified === true
  const corporateEmailVerified = !!row.corporate_email_verified_at
  return {
    taxVerified,
    corporateEmail: row.corporate_email,
    corporateEmailVerified,
    domainMatches,
    eligible: taxVerified && corporateEmailVerified && domainMatches,
  }
}

/** Sarı tiki kurala göre verir veya geri alır. Rozet durumu değiştiyse 'granted' / 'revoked' döner. */
export async function syncOfficialBusiness(admin: SupabaseClient, userId: string): Promise<'granted' | 'revoked' | null> {
  const [{ data: row, error }, { data: badge }] = await Promise.all([
    admin
      .from('users')
      .select('role, tax_id_verified, corporate_email, corporate_email_verified_at, social_links, displayed_badges')
      .eq('id', userId)
      .maybeSingle(),
    admin.from('user_badges').select('id').eq('user_id', userId).eq('badge_id', OFFICIAL_BADGE).maybeSingle(),
  ])
  if (error || !row) throw new Error(`Marka okunamadı: ${error?.message ?? 'bulunamadı'}`)

  const shouldHave = row.role === 'brand' && evaluateOfficialBusiness(row).eligible
  const hasBadge = !!badge
  const displayed = (row.displayed_badges as string[] | null) ?? []

  if (shouldHave && !hasBadge) {
    const { error: badgeError } = await admin
      .from('user_badges')
      .upsert({ user_id: userId, badge_id: OFFICIAL_BADGE, earned_at: new Date().toISOString() }, { onConflict: 'user_id,badge_id' })
    if (badgeError) throw new Error(`Resmi İşletme rozeti verilemedi: ${badgeError.message}`)
  }
  if (!shouldHave && hasBadge) {
    const { error: deleteError } = await admin.from('user_badges').delete().eq('user_id', userId).eq('badge_id', OFFICIAL_BADGE)
    if (deleteError) throw new Error(`Resmi İşletme rozeti kaldırılamadı: ${deleteError.message}`)
  }

  if (shouldHave !== displayed.includes(OFFICIAL_BADGE)) {
    const nextDisplayed = shouldHave
      ? [OFFICIAL_BADGE, ...displayed].slice(0, MAX_DISPLAYED_BADGES)
      : displayed.filter((badgeId) => badgeId !== OFFICIAL_BADGE)
    const { error: displayError } = await admin.from('users').update({ displayed_badges: nextDisplayed }).eq('id', userId)
    if (displayError) console.error('[official-business] displayed_badges güncellenemedi:', displayError.message)
  }

  if (shouldHave === hasBadge) return null
  return shouldHave ? 'granted' : 'revoked'
}

/**
 * Sarı tiki olan veya alabilecek tüm markaları kurala göre eşitler (saatlik görev). Kurala uymayanın
 * tiki geri alınır ve markaya bildirim gider; kuralı tamamlayan tiki alır (kullanıcı kararı, 2026-10-09).
 */
export async function sweepOfficialBusiness(admin: SupabaseClient) {
  const [holders, displayed, candidates] = await Promise.all([
    admin.from('user_badges').select('user_id').eq('badge_id', OFFICIAL_BADGE),
    admin.from('users').select('id').contains('displayed_badges', [OFFICIAL_BADGE]),
    admin
      .from('users')
      .select('id')
      .eq('role', 'brand')
      .eq('tax_id_verified', true)
      .not('corporate_email_verified_at', 'is', null),
  ])
  const firstError = holders.error ?? displayed.error ?? candidates.error
  if (firstError) throw new Error(`Sarı tik adayları okunamadı: ${firstError.message}`)

  const ids = new Set<string>([
    ...(holders.data ?? []).map((row) => row.user_id as string),
    ...(displayed.data ?? []).map((row) => row.id as string),
    ...(candidates.data ?? []).map((row) => row.id as string),
  ])

  const summary = { checked: 0, granted: 0, revoked: 0, errors: 0 }
  for (const userId of Array.from(ids)) {
    summary.checked++
    try {
      const change = await syncOfficialBusiness(admin, userId)
      if (change === 'granted') {
        summary.granted++
        await notifyUser(
          {
            userId,
            event: 'badge_change',
            title: 'Resmi İşletme rozetiniz verildi',
            message: 'Vergi levhanız ve kurumsal e-postanız doğrulandı; sarı tik profilinizde görünüyor.',
            link: '/dashboard/brand/badges',
            type: 'success',
          },
          admin,
        )
      }
      if (change === 'revoked') {
        summary.revoked++
        await notifyUser(
          {
            userId,
            event: 'badge_change',
            title: 'Resmi İşletme rozetiniz kaldırıldı',
            message:
              'Sarı tik kuralı güncellendi: vergi levhası onayı ve şirket alan adınızdaki kurumsal e-postanın doğrulanması gerekiyor. Profilinizden tamamladığınızda rozet otomatik olarak geri gelir.',
            link: '/dashboard/brand/profile',
            type: 'warning',
          },
          admin,
        )
      }
    } catch (error) {
      summary.errors++
      console.error(`[official-business] ${userId} değerlendirilemedi:`, error)
    }
  }
  return summary
}
