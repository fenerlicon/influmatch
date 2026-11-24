import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { awardDailyLogin, influcashChip } from '@/lib/influcash'

export const dynamic = 'force-dynamic'

/**
 * Günlük giriş ödülü (uygulama açılışında). İstanbul günü başına bir; 7 / 30 gün serisi, aylık üst sınır, bir kerelik ödüller.
 * Tekrar çağrı zararsız. { enabled, awarded, balance }; özellik kapalıysa { enabled: false }.
 */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const result = await awardDailyLogin(ctx.user.id)
  const balance = await influcashChip(ctx.user.id)
  if (balance === null) return mobileJson({ enabled: false })
  return mobileJson({ enabled: true, awarded: result.awarded, balance })
}
