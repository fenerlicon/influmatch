import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { completeIyzicoCheckout, paymentsCallbackBase } from '@/lib/payments/iyzico-flow'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * iyzico abonelik ödeme formunun dönüşü: tarayıcı bu adrese token'ı POST'lar (çapraz site POST'u olduğu için oturum çerezi
 * gelmeyebilir; kimliğe değil token'a bakılır). Sonuç iyzico API'sinden okunur, gövdedeki başka alanlara güvenilmez.
 */
async function handle(request: Request) {
  let token = ''
  const contentType = request.headers.get('content-type') ?? ''
  if (request.method === 'POST') {
    if (contentType.includes('application/json')) {
      const body = (await request.json().catch(() => null)) as { token?: unknown } | null
      token = typeof body?.token === 'string' ? body.token : ''
    } else {
      const form = await request.formData().catch(() => null)
      const value = form?.get('token')
      token = typeof value === 'string' ? value : ''
    }
  } else {
    token = new URL(request.url).searchParams.get('token') ?? ''
  }

  const base = paymentsCallbackBase()
  const admin = createSupabaseAdminClient()
  if (!admin || !token) return NextResponse.redirect(`${base}/dashboard/billing/result?durum=hata`, 303)
  try {
    const result = await completeIyzicoCheckout(admin, token.trim())
    return NextResponse.redirect(`${base}/dashboard/billing/result?durum=${result.ok ? 'tamam' : 'hata'}`, 303)
  } catch (error) {
    console.error('[iyzico/callback] işlenemedi:', error instanceof Error ? error.message : error)
    return NextResponse.redirect(`${base}/dashboard/billing/result?durum=beklemede`, 303)
  }
}

export const POST = handle
export const GET = handle
