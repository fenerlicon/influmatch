import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { iyzicoConfig, parseWebhookPayload, verifyWebhookSignature } from '@/lib/payments/iyzico'
import { processIyzicoWebhook } from '@/lib/payments/iyzico-flow'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * iyzico abonelik bildirimi (iyzico panelinde "Bildirim adresi" olarak tanımlanır, docs/PAYMENTS.md).
 * İmza (X-IYZ-SIGNATURE-V3) varsa doğrulanır; yanlışsa işlenmez. İmza doğru ya da yoksa bile yüke güvenilmez:
 * abonelik iyzico API'sinden yeniden okunur. Aynı bildirim payment_events benzersiz anahtarıyla bir kez işlenir.
 */
export async function POST(request: Request) {
  const admin = createSupabaseAdminClient()
  if (!admin || !iyzicoConfig()) return NextResponse.json({ error: 'not configured' }, { status: 503 })

  const raw = await request.json().catch(() => null)
  const payload = parseWebhookPayload(raw)
  if (!payload) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  const signatureValid = verifyWebhookSignature(request.headers.get('x-iyz-signature-v3'), payload)
  try {
    const result = await processIyzicoWebhook(admin, payload, signatureValid)
    return NextResponse.json({ status: result.status })
  } catch (error) {
    console.error('[iyzico/webhook] işlenemedi:', error instanceof Error ? error.message : error)
    // 5xx: iyzico yeniden dener; saatlik eşitleme de yakalar.
    return NextResponse.json({ error: 'temporary' }, { status: 500 })
  }
}
