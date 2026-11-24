import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { saveShippingAs } from '@/lib/collaboration-shipping'

export const dynamic = 'force-dynamic'

/**
 * Barter teslimat adresi (2026-11-24; web ile aynı kod). Görünüm GET /api/mobile/collaborations/[id] içindeki `workspace.shipping`.
 * POST { recipient_name, phone, address_line, district, city, postal_code?, note? } → { success, message } (yalnızca influencer).
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  const result = await saveShippingAs(ctx.user.id, params.id, body)
  return mobileJson(result, result.success ? 200 : 400)
}
