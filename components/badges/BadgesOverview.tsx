import BadgeProgressInfo from '@/components/badges/BadgeProgressInfo'
import BadgeCatalog from '@/components/badges/BadgeCatalog'
import { PageHeader } from '@/components/ui'

/** Rozetler sayfası (iki rol ortak): kullanıcının durumu + tüm rozet kataloğu. Menüde değil, profil sayfalarından açılır. */
export default function BadgesOverview({ userRole }: { userRole: 'influencer' | 'brand' }) {
  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader title="Rozetler" description="Rozetler profilinde görünür; hangilerinin gösterileceğini profil düzenlemeden seçersin." />

      <BadgeProgressInfo userRole={userRole} />

      <BadgeCatalog defaultRole={userRole} />
    </div>
  )
}
