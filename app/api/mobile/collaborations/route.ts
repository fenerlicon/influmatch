import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { listCollaborationsFor, runCollaborationAction, type CollaborationAction } from '@/lib/collaborations'
import { fetchAccountRole } from '@/lib/viewer-role'

export const dynamic = 'force-dynamic'

/** Kullanıcının iş birlikleri (marka ve influencer). Sorgu: ?status=agreed|in_progress|published|completed|cancelled */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const role = await fetchAccountRole(ctx.supabase, ctx.user.id)
  if (role !== 'brand' && role !== 'influencer') return mobileJson({ role, collaborations: [] })

  const status = new URL(request.url).searchParams.get('status')
  const result = await listCollaborationsFor(ctx.supabase, ctx.user.id, { status })
  if (!result.success) return mobileJson({ error: result.error }, 500)
  return mobileJson({ role, collaborations: result.collaborations })
}

const ACTIONS: CollaborationAction[] = ['start', 'publish', 'approve', 'cancel', 'open_room']

/**
 * İş birliği işlemi. Gövde: { id, action: 'start' | 'publish' | 'approve' | 'cancel' | 'open_room', url?, reason? }
 * Yetki ortak kodda: yalnızca kaydın tarafı, rolüne ve duruma uygun işlemi yapabilir.
 */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || typeof body.id !== 'string' || !ACTIONS.includes(body.action)) {
    return mobileJson({ error: 'Geçersiz istek.' }, 400)
  }

  const result = await runCollaborationAction(ctx.user.id, body.id, {
    action: body.action,
    url: typeof body.url === 'string' ? body.url : null,
    reason: typeof body.reason === 'string' ? body.reason : null,
  })
  return mobileJson(result, result.success ? 200 : 400)
}
