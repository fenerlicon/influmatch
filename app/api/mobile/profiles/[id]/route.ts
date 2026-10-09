import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { getProfileForViewer } from '@/lib/profile-reads'

export const dynamic = 'force-dynamic'

/**
 * Profil detayı (mobil InfluencerDetail). Web profil sayfasıyla aynı kural (lib/profile-reads.ts):
 * { status: 'ok', profile, socialAccounts } | { status: 'brand_unverified', verificationStatus }
 * | { status: 'wheel_blocked', profilesPerSpin, windowHours, expiresAt } | 404.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const access = await getProfileForViewer(ctx.supabase, ctx.user.id, { id: params.id })
  if (access.status === 'not_found') return mobileJson({ error: 'Profil bulunamadı.' }, 404)
  if (access.status === 'brand_unverified') {
    return mobileJson({ status: access.status, verificationStatus: access.viewer.verification_status })
  }
  if (access.status === 'wheel_blocked') {
    return mobileJson({
      status: access.status,
      profilesPerSpin: access.wheel.profilesPerSpin,
      windowHours: access.wheel.windowHours,
      expiresAt: access.wheel.spin?.expires_at ?? null,
    })
  }
  return mobileJson({ status: 'ok', profile: access.profile, socialAccounts: access.socialAccounts })
}
