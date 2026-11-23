import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { afterCardUpdate, paymentsCallbackBase, verifyCardCallbackSignature } from '@/lib/payments/iyzico-flow'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Kart güncelleme formunun dönüşü. Abonelik iyzico'dan yeniden okunur, ödemesi alınamamışsa son ödeme yeniden denenir.
 * Adresteki kimlik sunucunun imzasıyla gelir (sig); imzasız / yanlış imzalı istekte hiçbir şey yapılmaz.
 */
async function handle(request: Request) {
  const url = new URL(request.url)
  const sid = url.searchParams.get('sid') ?? ''
  const admin = createSupabaseAdminClient()
  if (admin && UUID.test(sid) && verifyCardCallbackSignature(sid, url.searchParams.get('sig'))) {
    try {
      await afterCardUpdate(admin, sid)
    } catch (error) {
      console.error('[iyzico/card-callback] işlenemedi:', error instanceof Error ? error.message : error)
    }
  }
  return NextResponse.redirect(`${paymentsCallbackBase()}/dashboard/billing?kart=guncellendi`, 303)
}

export const POST = handle
export const GET = handle
