import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { cancelApplicationAs, updateApplicationStatusAs, type ApplicationStatus } from '@/lib/adverts'

export const dynamic = 'force-dynamic'

/** Marka başvuru durumunu değiştirir. Gövde: { status: 'pending' | 'shortlisted' | 'accepted' | 'rejected' } */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  const result = await updateApplicationStatusAs(ctx.supabase, ctx.user.id, params.id, body?.status as ApplicationStatus)
  return mobileJson(result, result.error ? 400 : 200)
}

/** Influencer bekleyen başvurusunu geri çeker. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const result = await cancelApplicationAs(ctx.supabase, ctx.user.id, params.id)
  return mobileJson(result, result.error ? 400 : 200)
}
