import { createSupabaseServerClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import { Link2 } from 'lucide-react'
import StatsHistory from '@/components/dashboard/StatsHistory'
import { ButtonLink, Card, EmptyState, PageHeader } from '@/components/ui'

export const metadata: Metadata = {
  title: 'İstatistikler | InfluMatch',
}

export default async function StatsPage() {
  const supabase = createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Hem Instagram hem TikTok bağlı kullanıcıda .single() hata veriyordu (2.10-S1).
  // Geçmiş grafiği Instagram'dan beslenir; Instagram yoksa diğer hesap gösterilir.
  const { data: socialAccounts } = await supabase
    .from('social_accounts')
    .select('id, platform')
    .eq('user_id', user.id)
  const socialAccount =
    socialAccounts?.find((account) => account.platform === 'instagram') ?? socialAccounts?.[0] ?? null

  const history = socialAccount
    ? (
        await supabase
          .from('social_account_history')
          .select('*')
          .eq('social_account_id', socialAccount.id)
          .order('recorded_at', { ascending: true })
      ).data
    : null

  return (
    <div className="grid gap-5">
      <PageHeader title="İstatistikler" description="Bağlı hesabının zaman içindeki gelişimi. Markalar profilinde güncel değerleri görür." />
      {socialAccount ? (
        <StatsHistory history={history || []} />
      ) : (
        <Card>
          <EmptyState
            icon={Link2}
            title="Bağlı hesap yok"
            description="Gelişim grafiklerini görmek için önce Instagram hesabını bağla."
            action={<ButtonLink href="/dashboard/influencer/profile" variant="primary" size="sm">Hesap bağla</ButtonLink>}
          />
        </Card>
      )}
    </div>
  )
}
