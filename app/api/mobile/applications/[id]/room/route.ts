import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { openApplicationRoomAs } from '@/lib/adverts'

export const dynamic = 'force-dynamic'

/** Başvuruya ait sohbet odasını açar veya mevcut olanı döner. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const result = await openApplicationRoomAs(ctx.supabase, ctx.user.id, params.id)
  return mobileJson(result, result.error ? 400 : 200)
}
