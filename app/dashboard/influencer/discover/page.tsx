import { redirect } from 'next/navigation'
import DiscoverGrid from '@/components/discover/DiscoverGrid'
import { PageHeader } from '@/components/ui'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { getEnrichedInfluencers } from '@/utils/fetchInfluencers'
import { hasActiveSpotlight } from '@/lib/spotlight-access'

// "Vitrinde görünmüyorsun" uyarısı kaldırıldı: influencer paneli doğrulanmış sosyal hesabı olmayanı zaten almıyor (ölü arayüz).
export default async function InfluencerDiscoverPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Kendi Spotlight durumu (süresi dolmuşsa PRO filtreleri ve benzer profiller açılmaz).
  const { data: currentUserData } = await supabase
    .from('users')
    .select('spotlight_active, spotlight_plan, spotlight_expires_at')
    .eq('id', user.id)
    .single()
  const isSpotlight = hasActiveSpotlight(currentUserData)

  // Marka keşfiyle aynı kaynak: yalnızca doğrulanmış hesapların istatistikleri, seçilen rozetler.
  const influencers = await getEnrichedInfluencers()

  return (
    <div>
      <PageHeader title="Keşfet" description="Diğer influencer profillerini incele; markaların keşifte gördüğü kartlar bunlar." />
      <DiscoverGrid
        viewerRole="influencer"
        influencers={influencers}
        isSpotlightMember={isSpotlight}
        spotlightPlan={isSpotlight ? (currentUserData?.spotlight_plan ?? null) : null}
        emptyTitle="Henüz listelenen profil yok"
      />
    </div>
  )
}
