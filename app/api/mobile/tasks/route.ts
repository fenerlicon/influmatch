import { getBearerUser, mobileJson } from '@/lib/mobile-auth'
import { createTaskProofUploadUrlAs, getTasksOverviewAs, submitTaskAs } from '@/lib/tasks'

export const dynamic = 'force-dynamic'

/** Görevler ekranı: { overview } (görevler + ilerleme, davet kodu, ödüller). Kurallar web ile aynı (lib/tasks.ts). */
export async function GET(request: Request) {
  const user = await getBearerUser(request)
  if (!user) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const result = await getTasksOverviewAs(user.id)
  return mobileJson(result, result.success ? 200 : 400)
}

/**
 * Gövde: { action: 'submit', taskId, postUrl?, proofPath? } ya da { action: 'upload-url', extension }
 * (story ekran görüntüsü task-proofs kovasına imzalı adresle yüklenir, sonra 'submit' proofPath ile).
 */
export async function POST(request: Request) {
  const user = await getBearerUser(request)
  if (!user) return mobileJson({ error: 'Oturum gerekli.' }, 401)
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return mobileJson({ error: 'Geçersiz istek.' }, 400)

  if (body.action === 'upload-url') {
    const result = await createTaskProofUploadUrlAs(user.id, String(body.extension ?? ''))
    return mobileJson(result, result.success ? 200 : 400)
  }
  if (body.action === 'submit') {
    const result = await submitTaskAs(user.id, { taskId: body.taskId, postUrl: body.postUrl, proofPath: body.proofPath })
    return mobileJson(result, result.success ? 200 : 400)
  }
  return mobileJson({ error: 'Geçersiz işlem.' }, 400)
}
