import Link from 'next/link'
import { redirect } from 'next/navigation'
import CollaborationWorkspaceView from '@/components/dashboard/CollaborationWorkspace'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { fetchAccountRole } from '@/lib/viewer-role'
import { getCollaborationWorkspace } from '@/lib/collaboration-workspace'

export const revalidate = 0

export default async function CollaborationDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = await fetchAccountRole(supabase, user.id)
  if (role !== 'brand' && role !== 'influencer') redirect('/dashboard')

  // RLS'li istemci: taraf olmayan kullanıcı kaydı göremez ve "bulunamadı" alır.
  const result = await getCollaborationWorkspace(supabase, user.id, params.id)

  return (
    <div className="space-y-6">
      <Link href="/dashboard/collaborations" className="inline-flex text-sm text-gray-400 transition hover:text-soft-gold">
        ← İş Birlikleri
      </Link>
      {result.success ? (
        <CollaborationWorkspaceView workspace={result.workspace} currentUserId={user.id} />
      ) : (
        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">{result.error}</div>
      )}
    </div>
  )
}
