import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { acceptCommitment, getCommitmentStatus } from '@/lib/collaboration-trust'
import { holdNoticeFor } from '@/lib/collaboration-disputes'
import { COMMITMENT_TEXT } from '@/lib/collaboration-trust-shared'

export const dynamic = 'force-dynamic'

/**
 * Güvenli iş birliği (2026-11-23): marka taahhüdü durumu ve hesap kısıtı.
 * { commitment: { required, accepted, acceptedAt, version, text }, hold: { kind, reason, since } | null }
 * required false ise (SQL canlıda değil ya da marka değil) mobil pencere göstermez.
 */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const [commitment, hold] = await Promise.all([getCommitmentStatus(ctx.user.id), holdNoticeFor(ctx.user.id)])
  return mobileJson({ commitment: { ...commitment, text: COMMITMENT_TEXT }, hold })
}

/** Taahhüdü kabul et. Gövde: { accepted: true, version } */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const body = (await request.json().catch(() => null)) as { accepted?: unknown; version?: unknown } | null
  const result = await acceptCommitment(ctx.user.id, body ?? {}, 'mobile')
  return mobileJson(result, result.success ? 200 : 400)
}
