import { revalidatePath } from 'next/cache'
import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { saveOnboarding } from '@/lib/onboarding'

export const dynamic = 'force-dynamic'

const str = (value: unknown): string => (typeof value === 'string' ? value : '')
const optStr = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null)

/**
 * Mobil profil tamamlama. Web onboarding'le aynı doğrulama ve kayıt kodu (lib/onboarding.ts).
 * Gövde: { role, fullName, username, city, bio, category, avatarUrl, creatorType,
 *          socialLinks: { instagram, tiktok, youtube, website },
 *          marka için: corporateEmail, taxId, taxOffice, taxOfficeCity }
 * Rol mevcut kullanıcı kaydından alınır; gövdedeki rol yalnızca kayıt yoksa kullanılır.
 */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ success: false, error: 'Oturum gerekli.' }, 401)

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return mobileJson({ success: false, error: 'Geçersiz istek.' }, 400)

  const links = body.socialLinks && typeof body.socialLinks === 'object' ? body.socialLinks : {}
  const creatorType = str(body.creatorType)

  const result = await saveOnboarding(
    ctx.supabase,
    { id: ctx.user.id, email: ctx.user.email },
    {
      role: body.role === 'brand' ? 'brand' : 'influencer',
      fullName: str(body.fullName),
      username: str(body.username),
      city: str(body.city),
      bio: str(body.bio),
      category: str(body.category),
      avatarUrl: optStr(body.avatarUrl),
      creatorType: creatorType === 'influencer' || creatorType === 'ugc' || creatorType === 'both' ? creatorType : undefined,
      corporateEmail: optStr(body.corporateEmail),
      taxId: optStr(body.taxId),
      taxOffice: optStr(body.taxOffice),
      taxOfficeCity: optStr(body.taxOfficeCity),
      socialLinks: {
        instagram: optStr(links.instagram),
        tiktok: optStr(links.tiktok),
        youtube: optStr(links.youtube),
        website: optStr(links.website),
      },
    },
  )

  if (!result.success) return mobileJson(result, 400)
  revalidatePath('/dashboard')
  return mobileJson({ success: true, role: result.data.role })
}
