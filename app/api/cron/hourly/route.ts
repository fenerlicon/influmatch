import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { runApiKeyHealthCheck } from '@/lib/api-key-health'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * SAATLİK BAKIM GÖREVİ.
 * Vercel Hobby planı saatlik cron'a izin vermediği için Supabase pg_cron tarafından çağrılır
 * (kurulum: supabase/cron/hourly_jobs.sql). İstek "Authorization: Bearer <CRON_SECRET>" taşımalıdır.
 *
 * - Apify / Gemini anahtarlarının sağlık ve kredi kontrolü; sorun varsa admin'e özet e-posta.
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
    }
  } catch (error) {
    console.error('[cron/hourly] API anahtar kontrolü başarısız:', error)
    result.apiKeysError = error instanceof Error ? error.message : String(error)
  }

  return NextResponse.json(result)
}
