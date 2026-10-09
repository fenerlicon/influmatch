import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { saveAdvertAs } from '@/lib/adverts'
import { listOpenAdvertsWithOwners } from '@/lib/profile-reads'

export const dynamic = 'force-dynamic'

/** Açık ilanlar + ilan sahibi marka kartları (başka hesapların satırları istemciden okunamaz, 3.17-S2). ?limit= (en fazla 100). */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const limit = Number(new URL(request.url).searchParams.get('limit')) || 40
  const result = await listOpenAdvertsWithOwners(ctx.supabase, limit)
  return mobileJson(result, 'error' in result ? 500 : 200)
}

/** İlan oluşturur ya da günceller (gövdede id varsa). Kurallar lib/adverts.ts. */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return mobileJson({ error: 'Geçersiz istek.' }, 400)
  const result = await saveAdvertAs(ctx.supabase, ctx.user.id, body)
  return mobileJson(result, result.error ? 400 : 200)
}
