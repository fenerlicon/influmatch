import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { processAppleNotification } from '@/lib/payments/store-flow'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * App Store Server Notifications V2 (App Store Connect > Uygulama > App Store Server Notifications; canlı ve sandbox adresi bu uç).
 * Gövde { signedPayload }: Apple kök sertifikasına bağlı zincirle doğrulanır; geçersizse 400. Aynı bildirim (notificationUUID) bir kez işlenir.
 */
export async function POST(request: Request) {
  const admin = createSupabaseAdminClient()
  if (!admin) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  const body = (await request.json().catch(() => null)) as { signedPayload?: unknown } | null
  try {
    const result = await processAppleNotification(admin, body?.signedPayload)
    if (result.status === 'invalid') return NextResponse.json({ error: 'invalid' }, { status: 400 })
    return NextResponse.json({ status: result.status })
  } catch (error) {
    console.error('[apple/notifications] işlenemedi:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'temporary' }, { status: 500 })
  }
}
