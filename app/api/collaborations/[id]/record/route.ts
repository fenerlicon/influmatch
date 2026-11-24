import { createSupabaseServerClient } from '@/utils/supabase/server'
import { buildCollaborationRecord, renderCollaborationRecordHtml, verifyRecordToken } from '@/lib/collaboration-record'

export const dynamic = 'force-dynamic'

/**
 * İş birliği kaydı (yazdırılabilir HTML). Yetki: web çerez oturumu ya da mobilin ürettiği 10 dakikalık imzalı bağlantı (?t=).
 * Her iki yolda da yalnızca iş birliğinin tarafları ve admin görür (lib/collaboration-record.ts); diğerlerine 404.
 * ?indir=1 dosya olarak indirir.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const url = new URL(request.url)
  let viewerId = verifyRecordToken(url.searchParams.get('t'), params.id)
  if (!viewerId) {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    viewerId = user?.id ?? null
  }
  if (!viewerId) return new Response('Oturum gerekli.', { status: 401, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

  const record = await buildCollaborationRecord(params.id, viewerId)
  if (!record) return new Response('İş birliği bulunamadı.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'no-referrer',
    // Belgede yalnızca satır içi stil ve yazdır düğmesi var; dış kaynak yüklenmez.
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'",
  }
  if (url.searchParams.get('indir') === '1') {
    headers['Content-Disposition'] = `attachment; filename="is-birligi-kaydi-${params.id.slice(0, 8)}.html"`
  }
  return new Response(renderCollaborationRecordHtml(record), { status: 200, headers })
}
