import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { refreshDeliverableMetricsAs } from '@/lib/post-metrics'

export const dynamic = 'force-dynamic'
// Bir Apify koşusu bekler (en fazla ~45 sn).
export const maxDuration = 60

/**
 * Sonuç raporu "Şimdi güncelle" (3.20). Gövde: { deliverableId }. Yalnızca iş birliğinin markası, teslimat başına 6 saatte bir
 * (kilit ve taraf kontrolü lib/post-metrics.ts'te; ölçümler GET /api/mobile/collaborations/[id] içinde teslimat başına gelir).
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const body = await request.json().catch(() => null)
  const deliverableId = body && typeof body.deliverableId === 'string' ? body.deliverableId : ''
  const result = await refreshDeliverableMetricsAs(ctx.supabase, ctx.user.id, params.id, deliverableId)
  return mobileJson(result, result.success ? 200 : 400)
}
