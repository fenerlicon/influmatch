import { Heart, Sparkles } from 'lucide-react'
import { PageHeader, Tabs } from '@/components/ui'

export type BrandDiscoverTab = 'all' | 'recommended' | 'favorites'

/** Marka Keşfet başlığı + sekmeler (Tümü / Önerilenler / Favoriler ve Listeler); her sekme kendi adresinde. */
export default function BrandDiscoverHeader({ tab, counts }: { tab: BrandDiscoverTab; counts?: Partial<Record<BrandDiscoverTab, number>> }) {
  return (
    <>
      <PageHeader title="Keşfet" description="Yalnızca doğrulanmış Instagram veya TikTok hesabı olan profiller listelenir." className="mb-3.5" />
      <Tabs
        label="Keşif görünümü"
        value={tab}
        className="mb-4"
        items={[
          { value: 'all', label: 'Tümü', href: '/dashboard/brand/discover', count: counts?.all },
          { value: 'recommended', label: 'Önerilenler', href: '/dashboard/brand/ai', icon: <Sparkles />, count: counts?.recommended },
          { value: 'favorites', label: 'Favoriler ve Listeler', href: '/dashboard/brand/favorites', icon: <Heart />, count: counts?.favorites },
        ]}
      />
    </>
  )
}
