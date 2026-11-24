import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { createRecordToken } from '@/lib/collaboration-record'

export const dynamic = 'force-dynamic'

/**
 * İş birliği kaydı bağlantısı (mobil). Tarayıcı çerez taşımadığı için 10 dakika geçerli, bu kullanıcı + iş birliğine bağlı imzalı
 * bağlantı döner: { url }. Taraf kontrolü bağlantı açılırken sunucuda yapılır (/api/collaborations/[id]/record).
 * Önce RLS'li okumayla tarafı olduğu doğrulanır (taraf olmayana bağlantı üretilmez).
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const { data } = await ctx.supabase.from('collaborations').select('id').eq('id', params.id).maybeSingle()
  if (!data) return mobileJson({ error: 'İş birliği bulunamadı.' }, 404)
  const token = createRecordToken(ctx.user.id, params.id)
  if (!token) return mobileJson({ error: 'Sunucu yapılandırması eksik.' }, 500)
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://influmatch.net').replace(/\/+$/, '')
  return mobileJson({ url: `${base}/api/collaborations/${params.id}/record?t=${encodeURIComponent(token)}` })
}
