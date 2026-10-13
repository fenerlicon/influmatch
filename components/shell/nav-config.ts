import {
  Award, Briefcase, Building2, Compass, Heart, Home, Inbox, LayoutDashboard, LifeBuoy, LineChart, Megaphone, MessageSquare,
  MessagesSquare, UserRound, type LucideIcon,
} from 'lucide-react'

export type ShellRole = 'influencer' | 'brand' | 'admin'

export interface NavItem {
  id: string
  label: string
  href: string
  icon: LucideIcon
  /** Yalnızca tam eşleşmede etkin (ana sayfalar). */
  exact?: boolean
  /** Bu önekler de bu maddeyi etkin yapar (ör. favori listesi detayları). */
  alsoActive?: string[]
  /** Okunmamış mesaj rozeti. */
  unread?: boolean
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

// Menü (docs/REDESIGN.md). Teklifler + İş Birlikleri birleşip "İşler" olunca (3. aşama) ve rozetler profile
// taşınınca buradaki maddeler de değişir; o zamana kadar mevcut sayfalara gider.
const INFLUENCER: NavGroup[] = [
  { items: [{ id: 'home', label: 'Ana Sayfa', href: '/dashboard/influencer', icon: Home, exact: true }] },
  {
    label: 'Çalış',
    items: [
      { id: 'offers', label: 'Teklifler', href: '/dashboard/offers', icon: Inbox },
      { id: 'collabs', label: 'İş Birlikleri', href: '/dashboard/collaborations', icon: Briefcase },
      { id: 'messages', label: 'Mesajlar', href: '/dashboard/messages', icon: MessageSquare, unread: true },
    ],
  },
  {
    label: 'Fırsatlar',
    items: [
      { id: 'adverts', label: 'İlanlar', href: '/dashboard/influencer/advert', icon: Megaphone },
      { id: 'discover', label: 'Keşfet', href: '/dashboard/influencer/discover', icon: Compass },
    ],
  },
  {
    label: 'Ben',
    items: [
      { id: 'profile', label: 'Profilim', href: '/dashboard/influencer/profile', icon: UserRound },
      { id: 'stats', label: 'İstatistikler', href: '/dashboard/influencer/stats', icon: LineChart },
      { id: 'badges', label: 'Rozetler', href: '/dashboard/influencer/badges', icon: Award },
    ],
  },
]

const BRAND: NavGroup[] = [
  { items: [{ id: 'home', label: 'Ana Sayfa', href: '/dashboard/brand', icon: Home, exact: true }] },
  {
    label: 'Bul',
    items: [
      { id: 'discover', label: 'Keşfet', href: '/dashboard/brand/discover', icon: Compass, alsoActive: ['/dashboard/brand/ai'] },
      { id: 'favorites', label: 'Favoriler', href: '/dashboard/brand/favorites', icon: Heart, alsoActive: ['/dashboard/brand/inflist'] },
      { id: 'adverts', label: 'İlanlar', href: '/dashboard/brand/advert', icon: Megaphone },
    ],
  },
  {
    label: 'Çalış',
    items: [
      { id: 'offers', label: 'Teklifler', href: '/dashboard/brand/offers', icon: Inbox },
      { id: 'collabs', label: 'İş Birlikleri', href: '/dashboard/collaborations', icon: Briefcase },
      { id: 'messages', label: 'Mesajlar', href: '/dashboard/messages', icon: MessageSquare, unread: true },
    ],
  },
  {
    label: 'Marka',
    items: [
      { id: 'profile', label: 'Profilim', href: '/dashboard/brand/profile', icon: Building2 },
      { id: 'badges', label: 'Rozetler', href: '/dashboard/brand/badges', icon: Award },
    ],
  },
]

const ADMIN: NavGroup[] = [
  { items: [{ id: 'admin', label: 'Admin Paneli', href: '/admin', icon: LayoutDashboard, exact: true }] },
  {
    label: 'Destek',
    items: [
      { id: 'support', label: 'Destek Talepleri', href: '/admin/support', icon: LifeBuoy },
      { id: 'feedback', label: 'Geri Bildirimler', href: '/admin/feedback', icon: MessagesSquare },
      { id: 'messages', label: 'Mesajlar', href: '/dashboard/messages', icon: MessageSquare, unread: true },
    ],
  },
]

export const NAV: Record<ShellRole, NavGroup[]> = { influencer: INFLUENCER, brand: BRAND, admin: ADMIN }

/** Mobil alt sekme çubuğundaki maddeler (sonuncusu her zaman "Menü"). */
export const MOBILE_TABS: Record<ShellRole, string[]> = {
  influencer: ['home', 'offers', 'adverts', 'messages'],
  brand: ['home', 'discover', 'offers', 'messages'],
  admin: ['admin', 'support', 'messages'],
}

export const SETTINGS_HREF: Record<ShellRole, string | null> = {
  influencer: '/dashboard/influencer/settings',
  brand: '/dashboard/brand/settings',
  admin: null,
}

// Spotlight menüsü doğrudan rolün paket sayfasını açar (ara seçim sayfası yok).
export const SPOTLIGHT_HREF: Record<ShellRole, string | null> = {
  influencer: '/dashboard/spotlight/influencer',
  brand: '/dashboard/spotlight/brand',
  admin: null,
}

export function isNavActive(item: NavItem, pathname: string) {
  const match = (p: string) => pathname === p || pathname.startsWith(`${p}/`)
  if (item.exact) return pathname === item.href
  return match(item.href) || (item.alsoActive ?? []).some(match)
}

/** Üst çubuktaki başlık: etkin menü maddesi ya da bilinen sayfa. */
export function titleFor(role: ShellRole, pathname: string): string {
  for (const group of NAV[role]) {
    for (const item of group.items) if (isNavActive(item, pathname)) return item.label
  }
  if (pathname.startsWith('/profile/')) return 'Profil'
  if (pathname.includes('/settings')) return 'Ayarlar'
  if (pathname.startsWith('/dashboard/spotlight')) return 'Spotlight'
  return 'Panel'
}
