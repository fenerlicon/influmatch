import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { runApiKeyHealthCheck } from '@/lib/api-key-health'
import { expireSpotlights } from '@/lib/spotlight-expiry'
import { sweepBlueTicks } from '@/lib/blue-tick'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * SAATLİK BAKIM GÖREVİ.
 * Vercel Hobby planı saatlik cron'a izin vermediği için Supabase pg_cron tarafından çağrılır
 * (kurulum: supabase/cron/hourly_jobs.sql). İstek "Authorization: Bearer <CRON_SECRET>" taşımalıdır.
 *
 * - Apify / Gemini anahtarlarının sağlık ve kredi kontrolü; sorun varsa admin'e özet e-posta.
 * - Mavi tik kuralının yeniden değerlendirilmesi (Spotlight süresi dolanlar, eşiğin altına düşenler).
 */
export async function GET(req: Request) {
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

  return NextResponse.json(result)
}
