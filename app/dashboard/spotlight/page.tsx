import { ArrowRight, BrainCircuit, Crown } from 'lucide-react'
import { redirect } from 'next/navigation'
import { ButtonLink, Card, PageHeader } from '@/components/ui'
import { createSupabaseServerClient } from '@/utils/supabase/server'

export const metadata = {
  title: 'Spotlight | Influmatch',
  description: 'Markalar ve influencerlar için Spotlight paketleri.',
}

const OPTIONS = [
  {
    icon: Crown,
    title: 'Influencer paketleri',
    description: 'Spotlight rozeti ve çerçevesi, keşifte öncelikli listeleme, profil görüntülenmeleri ve anlık ilan alarmı.',
    href: '/dashboard/spotlight/influencer',
  },
  {
    icon: BrainCircuit,
    title: 'Marka paketleri',
    description: 'Akıllı eşleştirme, uyum skoru, benzer profil keşfi ve öne çıkan ilanlar.',
    href: '/dashboard/spotlight/brand',
  },
]

export default async function SpotlightSelectionPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Rol DB'den (metadata eskiyebilir)
  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()
  const role = userData?.role || 'influencer'

  // Rol belliyken ara seçim sayfası gereksiz (docs/REDESIGN.md); admin ikisini de görür.
  if (role === 'influencer') redirect('/dashboard/spotlight/influencer')
  if (role === 'brand') redirect('/dashboard/spotlight/brand')

  return (
    <div className="grid gap-5">
      <PageHeader title="Spotlight" description="İki rolün paket sayfaları." />
      <div className="grid gap-4 md:grid-cols-2">
        {OPTIONS.map((o) => (
          <Card key={o.href} padded className="grid content-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
              <o.icon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-[16px] font-semibold text-ink">{o.title}</h2>
              <p className="mt-1 text-[13px] text-ink-muted">{o.description}</p>
            </div>
            <div>
              <ButtonLink href={o.href} size="sm" rightIcon={<ArrowRight />}>Paketleri gör</ButtonLink>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
