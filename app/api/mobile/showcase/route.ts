import { revalidatePath } from 'next/cache'
import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { setShowcaseVisibilityAs } from '@/lib/showcase'

export const dynamic = 'force-dynamic'

/** Vitrin modu (web ile aynı kurallar, lib/showcase.ts). Gövde: { visible: boolean } */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ success: false, error: 'Oturum gerekli.' }, 401)

  const body = await request.json().catch(() => null)
  if (typeof body?.visible !== 'boolean') return mobileJson({ success: false, error: 'Geçersiz istek.' }, 400)

  try {
    await setShowcaseVisibilityAs(ctx.supabase, ctx.user, body.visible)
  } catch (error) {
    return mobileJson({ success: false, error: error instanceof Error ? error.message : 'Durum güncellenemedi.' }, 400)
  }
  revalidatePath('/dashboard/brand/discover')
  return mobileJson({ success: true })
}
