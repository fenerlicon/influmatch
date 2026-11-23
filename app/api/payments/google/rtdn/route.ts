import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { parseRtdnMessage } from '@/lib/payments/google'
import { processGoogleRtdn } from '@/lib/payments/store-flow'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function secretMatches(given: string | null, expected: string | undefined) {
  if (!given || !expected) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Google Play gerçek zamanlı geliştirici bildirimi (Pub/Sub push aboneliği). Push adresi
 * https://influmatch.net/api/payments/google/rtdn?token=<GOOGLE_RTDN_SECRET> olarak tanımlanır (docs/PAYMENTS.md).
 * Gizli anahtar tutmazsa 401. Yüke güvenilmez: satın alma Play Developer API'sinden yeniden okunur.
 */
export async function POST(request: Request) {
  if (!secretMatches(new URL(request.url).searchParams.get('token'), process.env.GOOGLE_RTDN_SECRET?.trim())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const admin = createSupabaseAdminClient()
  if (!admin) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  const message = parseRtdnMessage(await request.json().catch(() => null))
  // Biçimi bozuk mesaj yeniden denenmesin diye 200.
  if (!message) return NextResponse.json({ status: 'ignored' })
  try {
    const result = await processGoogleRtdn(admin, message)
    return NextResponse.json({ status: result.status })
  } catch (error) {
    console.error('[google/rtdn] işlenemedi:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'temporary' }, { status: 500 })
  }
}
