import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { applyToAdvertAs } from '@/lib/adverts'

export const dynamic = 'force-dynamic'

/** İlana başvurur. Gövde: { advertId, coverLetter, deliverableIdea?, budgetExpectation? } */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return mobileJson({ error: 'Geçersiz istek.' }, 400)
  const result = await applyToAdvertAs(ctx.supabase, ctx.user.id, body)
  return mobileJson(result, result.error ? 400 : 200)
}
