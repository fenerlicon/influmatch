import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { runApiKeyHealthCheck } from '@/lib/api-key-health'
import { expireSpotlights } from '@/lib/spotlight-expiry'
import { sweepBlueTicks } from '@/lib/blue-tick'
import { sweepMillionClub } from '@/lib/million-club'
import { sweepActivityBadges } from '@/lib/activity-badges'
import { sweepOfficialBusiness } from '@/lib/official-business'
import { refreshStaleAccounts } from '@/lib/social-stats'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Bir kazıma en fazla ~45 sn; 60 sn sınırının altında kalmak için yeni koşu bu süreden sonra başlamaz. */
const HOURLY_STATS_START_BUDGET_MS = 10_000

/**
 * SAATLİK BAKIM GÖREVİ.
 * Vercel Hobby planı saatlik cron'a izin vermediği için Supabase pg_cron tarafından çağrılır
 * (kurulum: supabase/cron/hourly_jobs.sql). İstek "Authorization: Bearer <CRON_SECRET>" taşımalıdır.
 *
 * - Apify anahtarlarının sağlık ve kredi kontrolü; sorun varsa admin'e özet e-posta.
 * - Mavi tik kuralının yeniden değerlendirilmesi (Spotlight süresi dolanlar, eşiğin altına düşenler).
 * - Sarı tik (Resmi İşletme) kurala göre eşitlenir; geri alınana bildirim gider.
 * - Milyon Kulübü rozeti (doğrulanmış hesapta 1M+ takipçi) ve etkinlik rozetleri (lib/activity-badges.ts).
 */
export async function GET(req: Request) {
  const startedAt = Date.now()
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const admin = createSupabaseAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY eksik.' }, { status: 500 })
  }

  const result: Record<string, unknown> = {}

  try {
    const report = await runApiKeyHealthCheck(admin, { sendEmail: true })
    result.apiKeys = {
      hasProblems: report.hasProblems,
      email: report.email,
      providers: report.providers.map(({ problemKeys, ...summary }) => ({
        ...summary,
        problems: problemKeys.map((k) => `${k.label}: ${k.status}`),
      })),
      resend: { level: report.resend.level, problems: report.resend.problems, warnings: report.resend.warnings },
    }
  } catch (error) {
    console.error('[cron/hourly] API anahtar kontrolü başarısız:', error)
    result.apiKeysError = error instanceof Error ? error.message : String(error)
  }

  // Mavi tik Spotlight'a bağlı olduğu için süresi dolan üyelikler tik taramasından önce kapatılır.
  try {
    const spotlight = await expireSpotlights(admin)
    result.spotlight = { expired: spotlight.expired.length, unverified: spotlight.unverified.length }
  } catch (error) {
    console.error('[cron/hourly] Spotlight süre kontrolü başarısız:', error)
    result.spotlightError = error instanceof Error ? error.message : String(error)
  }

  try {
    result.blueTicks = await sweepBlueTicks(admin)
  } catch (error) {
    console.error('[cron/hourly] Mavi tik değerlendirmesi başarısız:', error)
    result.blueTicksError = error instanceof Error ? error.message : String(error)
  }

  try {
    result.officialBusiness = await sweepOfficialBusiness(admin)
  } catch (error) {
    console.error('[cron/hourly] Sarı tik değerlendirmesi başarısız:', error)
    result.officialBusinessError = error instanceof Error ? error.message : String(error)
  }

  try {
    result.millionClub = await sweepMillionClub(admin)
  } catch (error) {
    console.error('[cron/hourly] Milyon Kulübü değerlendirmesi başarısız:', error)
    result.millionClubError = error instanceof Error ? error.message : String(error)
  }

  try {
    result.activityBadges = await sweepActivityBadges(admin)
  } catch (error) {
    console.error('[cron/hourly] Etkinlik rozetleri değerlendirilemedi:', error)
    result.activityBadgesError = error instanceof Error ? error.message : String(error)
  }

  // Bayat istatistikleri kalan zamanda küçük parçalar halinde yenile. Bir Apify koşusu 45 saniyeye kadar
  // sürdüğü için yeni koşu en geç 10. saniyede başlar; aksi halde görev 60 saniyelik sınırı aşıyordu
  // (pg_net zaman aşımı, 2026-10-08). Taramalar uzun sürdüyse bu turda yenileme yapılmaz, günlük cron sürdürür.
  try {
    result.statsRefresh = await refreshStaleAccounts(admin, { deadline: startedAt + HOURLY_STATS_START_BUDGET_MS, limit: 10 })
  } catch (error) {
    console.error('[cron/hourly] İstatistik yenileme başarısız:', error)
    result.statsRefreshError = error instanceof Error ? error.message : String(error)
  }

  return NextResponse.json(result)
}
