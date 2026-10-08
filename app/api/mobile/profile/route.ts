import { revalidatePath } from 'next/cache'
import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { saveBrandProfile, saveInfluencerProfile } from '@/lib/profile-update'
import { awardBadgesForUser } from '@/utils/badgeAwarding'

export const dynamic = 'force-dynamic'

const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

/**
 * Profil düzenleme (kısmi). Gövdede yalnızca değişen alanlar gelir; diğerleri mevcut kayıttan tamamlanır
 * ve web formuyla aynı doğrulama/kayıt kodu çalışır (lib/profile-update.ts).
 * Influencer: { fullName, city, bio, category, avatarUrl, creatorType, socialLinks }
 * Marka: { brandName, city, bio, category, avatarUrl, website, companyLegalName }
 */
export async function PATCH(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ success: false, error: 'Oturum gerekli.' }, 401)

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return mobileJson({ success: false, error: 'Geçersiz istek.' }, 400)

  const { data: current, error: currentError } = await ctx.supabase
    .from('users')
    .select('role, full_name, username, city, bio, category, avatar_url, social_links, creator_type, company_legal_name')
    .eq('id', ctx.user.id)
    .maybeSingle()
  if (currentError || !current) {
    return mobileJson({ success: false, error: 'Kullanıcı bilgileri alınamadı. Lütfen tekrar deneyin.' }, 400)
  }

  const links = (current.social_links as Record<string, string | null> | null) ?? {}

  try {
    if (current.role === 'brand') {
      await saveBrandProfile(ctx.supabase, ctx.user.id, {
        brandName: str(body.brandName) ?? current.full_name ?? '',
        username: current.username ?? '',
        city: str(body.city) ?? current.city ?? '',
        bio: str(body.bio) ?? current.bio ?? '',
        category: str(body.category) ?? current.category ?? '',
        logoUrl: body.avatarUrl !== undefined ? str(body.avatarUrl) ?? null : current.avatar_url ?? null,
        website: str(body.website) ?? links.website ?? '',
        linkedin: links.linkedin ?? '',
        instagram: links.instagram ?? '',
        kick: links.kick ?? null,
        twitter: links.twitter ?? null,
        twitch: links.twitch ?? null,
        // Vergi bilgileri mobilde marka doğrulama ekranından girilir; burada dokunulmaz.
        ...(body.companyLegalName !== undefined ? { companyLegalName: str(body.companyLegalName) ?? null } : {}),
      })
      await awardBadgesForUser(ctx.user.id)
      revalidatePath('/dashboard/brand/discover')
    } else {
      const incomingLinks = body.socialLinks && typeof body.socialLinks === 'object' ? body.socialLinks : {}
      const linkValue = (key: string) => (incomingLinks[key] !== undefined ? str(incomingLinks[key]) ?? null : links[key] ?? null)
      const creatorType = str(body.creatorType) ?? current.creator_type ?? undefined
      const payload = {
        fullName: str(body.fullName) ?? current.full_name ?? '',
        username: current.username ?? '',
        previousUsername: current.username ?? '',
        city: str(body.city) ?? current.city ?? '',
        bio: str(body.bio) ?? current.bio ?? '',
        category: str(body.category) ?? current.category ?? '',
        avatarUrl: body.avatarUrl !== undefined ? str(body.avatarUrl) ?? null : current.avatar_url ?? null,
        creatorType: creatorType === 'influencer' || creatorType === 'ugc' || creatorType === 'both' ? creatorType : undefined,
        socialLinks: {
          instagram: linkValue('instagram'),
          tiktok: linkValue('tiktok'),
          youtube: linkValue('youtube'),
          kick: linkValue('kick'),
          twitter: linkValue('twitter'),
          twitch: linkValue('twitch'),
        },
      } as const
      await saveInfluencerProfile(ctx.supabase, ctx.user.id, { ...payload, socialLinks: { ...payload.socialLinks } })
      await awardBadgesForUser(ctx.user.id)
      revalidatePath('/dashboard/brand/discover')
      if (current.username) revalidatePath(`/profile/${current.username}`)
    }
  } catch (error) {
    return mobileJson({ success: false, error: error instanceof Error ? error.message : 'Profil kaydedilemedi. Lütfen tekrar deneyin.' }, 400)
  }

  return mobileJson({ success: true })
}
