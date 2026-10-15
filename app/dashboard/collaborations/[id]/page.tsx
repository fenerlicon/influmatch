import { ArrowLeft } from 'lucide-react'
import { ButtonLink } from '@/components/ui'
import { worksHref } from '@/lib/works'
import { redirect } from 'next/navigation'
import CollaborationWorkspaceView from '@/components/dashboard/CollaborationWorkspace'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { fetchAccountRole } from '@/lib/viewer-role'
import { getCollaborationWorkspace } from '@/lib/collaboration-workspace'

export const revalidate = 0
// "Şimdi güncelle" (sonuç raporu) bir Apify koşusu bekler (en fazla ~45 sn).
export const maxDuration = 60

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
      <ButtonLink href={worksHref('active')} variant="ghost" size="sm" leftIcon={<ArrowLeft />} className="-ml-2">
        İşler'e dön
      </ButtonLink>
      {result.success ? (
        <CollaborationWorkspaceView workspace={result.workspace} currentUserId={user.id} />
      ) : (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-5 text-sm text-danger">{result.error}</div>
      )}
    </div>
  )
}
