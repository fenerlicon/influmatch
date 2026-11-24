import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { getOwnContact, needsPhone, saveOwnContact } from '@/lib/user-contact'

export const dynamic = 'force-dynamic'

/**
 * Telefon numarası (2026-11-24; yalnızca platform görür, lib/user-contact.ts).
 * GET → { phone, marketingSms, required } (required: numarası olmayan influencer / marka; panel kapısı)
 * POST { phone, marketingSms? } → { success }
 */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ success: false, error: 'Oturum gerekli.' }, 401)
  const { data: profile } = await ctx.supabase.from('users').select('role').eq('id', ctx.user.id).maybeSingle()
  const contact = await getOwnContact(ctx.user.id)
  return mobileJson({
    success: true,
    phone: contact?.phone ?? null,
    marketingSms: !!contact?.marketingSms,
    required: await needsPhone(ctx.user.id, profile?.role as string | null),
  })
}

export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ success: false, error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  const result = await saveOwnContact(ctx.user.id, { phone: body?.phone, marketingSms: typeof body?.marketingSms === 'boolean' ? body.marketingSms : undefined }, 'mobile')
  return mobileJson(result, result.success ? 200 : 400)
}
