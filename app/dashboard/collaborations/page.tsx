import { redirect } from 'next/navigation'
import CollaborationsManager from '@/components/dashboard/CollaborationsManager'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { fetchAccountRole } from '@/lib/viewer-role'
import { listCollaborationsFor } from '@/lib/collaborations'

export const revalidate = 0

export default async function CollaborationsPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = await fetchAccountRole(supabase, user.id)
  if (role !== 'brand' && role !== 'influencer') redirect('/dashboard')

  const result = await listCollaborationsFor(supabase, user.id)

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#141521] to-[#0C0D10] p-6 text-white shadow-glow">
        <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">İş Birlikleri</p>
        <h1 className="mt-2 text-2xl font-semibold">Anlaştığınız işler</h1>
        <p className="mt-2 max-w-2xl text-gray-300">
          {role === 'brand'
            ? 'Kabul edilen teklifler ve ilan başvuruları burada. Influencer yayın linkini girdiğinde içeriği kontrol edip onaylayın.'
            : 'Kabul ettiğiniz teklifler ve kabul edilen ilan başvurularınız burada. İçerik yayınlandığında linkini girin; marka onayladığında iş birliği tamamlanır.'}
        </p>
      </header>

      {result.success ? (
        <CollaborationsManager initialItems={result.collaborations} currentUserId={user.id} role={role} />
      ) : (
        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">{result.error}</div>
      )}
    </div>
  )
}
