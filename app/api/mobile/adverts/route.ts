import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { saveAdvertAs } from '@/lib/adverts'

export const dynamic = 'force-dynamic'

/** İlan oluşturur ya da günceller (gövdede id varsa). Kurallar lib/adverts.ts. */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return mobileJson({ error: 'Geçersiz istek.' }, 400)
  const result = await saveAdvertAs(ctx.supabase, ctx.user.id, body)
  return mobileJson(result, result.error ? 400 : 200)
}
