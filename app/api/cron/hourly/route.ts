import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { runApiKeyHealthCheck } from '@/lib/api-key-health'
import { expireSpotlights } from '@/lib/spotlight-expiry'
import { sweepBlueTicks } from '@/lib/blue-tick'
import { sweepMillionClub } from '@/lib/million-club'
import { sweepActivityBadges } from '@/lib/activity-badges'
import { sweepOfficialBusiness } from '@/lib/official-business'
import { refreshStaleAccounts } from '@/lib/social-stats'
import { autoCompleteCollaborations } from '@/lib/collaborations'
import { expireStaleOffers } from '@/lib/offers'
import { resetExpiredAvailability } from '@/lib/availability'
import { processAdvertAlerts } from '@/lib/advert-alerts'
import { processDueMetrics } from '@/lib/post-metrics'
import { processDueTaskMeasurements } from '@/lib/tasks'

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
 * - Yayın linkine 7 gün yanıt verilmeyen iş birlikleri otomatik tamamlanır (lib/collaborations.ts).
 * - 7 gün yanıtlanmayan teklifler "Süresi doldu" olur, markaya bildirim gider (lib/offers.ts).
 * - Yeni açılan ilanlar influencer ilan alarmlarıyla eşleştirilir (lib/advert-alerts.ts).
 * - Yayınlanan teslimatların gönderi ölçümleri (sonuç raporu, lib/post-metrics.ts): tek Apify koşusu, en fazla 10 gönderi.
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

  // Kısa veritabanı işi; istatistik yenilemesinden önce, toplam süre bütçesini aşmayacak şekilde.
  try {
    result.collaborations = await autoCompleteCollaborations(admin, { limit: 25, deadline: startedAt + 40_000 })
  } catch (error) {
    console.error('[cron/hourly] İş birliği otomatik tamamlama başarısız:', error)
    result.collaborationsError = error instanceof Error ? error.message : String(error)
  }

  try {
    result.offerExpiry = await expireStaleOffers(admin, { limit: 50, deadline: startedAt + 40_000 })
  } catch (error) {
    console.error('[cron/hourly] Teklif süresi kontrolü başarısız:', error)
    result.offerExpiryError = error instanceof Error ? error.message : String(error)
  }

  // Bitiş tarihi geçen "Şu an dolu" durumları (okuma zaten geçmiş tarihi "İş alıyorum" sayar; bu yalnızca temizlik).
  try {
    result.availability = await resetExpiredAvailability(admin)
  } catch (error) {
    console.error('[cron/hourly] Müsaitlik temizliği başarısız:', error)
    result.availabilityError = error instanceof Error ? error.message : String(error)
  }

  try {
    result.advertAlerts = await processAdvertAlerts(admin, { limit: 10, deadline: startedAt + 40_000 })
  } catch (error) {
    console.error('[cron/hourly] İlan alarmları işlenemedi:', error)
    result.advertAlertsError = error instanceof Error ? error.message : String(error)
  }

  // Bayat istatistikleri ve zamanı gelen gönderi ölçümlerini kalan zamanda küçük parçalar halinde al. Bir Apify koşusu 45 saniyeye
  // kadar sürdüğü için yeni koşu en geç 10. saniyede başlar; aksi halde görev 60 saniyelik sınırı aşıyordu (pg_net zaman aşımı,
  // 2026-10-08). İkisi paralel çalışır (ölçüm tek koşu: istatistiğin 3 eşzamanlı koşusuna en fazla 1 ekler). Taramalar uzun
  // sürdüyse bu turda yapılmaz; istatistiği günlük cron, ölçümü bir sonraki saat sürdürür.
  const statsDeadline = startedAt + HOURLY_STATS_START_BUDGET_MS
  // Görev ölçümü (tanıtım videoları, lib/tasks.ts) de aynı turda: tek koşu, en fazla 10 gönderi.
  const [stats, metrics, taskMetrics] = await Promise.allSettled([
    refreshStaleAccounts(admin, { deadline: statsDeadline, limit: 10 }),
    processDueMetrics(admin, { deadline: statsDeadline }),
    processDueTaskMeasurements(admin, { deadline: statsDeadline }),
  ])
  if (stats.status === 'fulfilled') result.statsRefresh = stats.value
  else {
    console.error('[cron/hourly] İstatistik yenileme başarısız:', stats.reason)
    result.statsRefreshError = stats.reason instanceof Error ? stats.reason.message : String(stats.reason)
  }
  if (metrics.status === 'fulfilled') result.postMetrics = metrics.value
  else {
    console.error('[cron/hourly] Gönderi ölçümleri alınamadı:', metrics.reason)
    result.postMetricsError = metrics.reason instanceof Error ? metrics.reason.message : String(metrics.reason)
  }
  if (taskMetrics.status === 'fulfilled') result.taskMetrics = taskMetrics.value
  else {
    console.error('[cron/hourly] Görev ölçümleri alınamadı:', taskMetrics.reason)
    result.taskMetricsError = taskMetrics.reason instanceof Error ? taskMetrics.reason.message : String(taskMetrics.reason)
  }

  return NextResponse.json(result)
}
