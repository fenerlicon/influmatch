import {
  Award, Bell, Briefcase, Building2, Compass, Flag, Home, KeyRound, LifeBuoy, LineChart, Link2, Megaphone, MessageSquare,
  MessagesSquare, SlidersHorizontal, UserRound, Users, type LucideIcon,
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

// Menü (docs/REDESIGN.md). Teklifler + iş birlikleri "İşler"de (3. aşama); rozetler profile taşınınca o madde de kalkar.
// Eski teklif/iş birliği adresleri (yönlendirme ve iş detayı) İşler'i etkin gösterir.
const WORKS_ALIASES = ['/dashboard/collaborations', '/dashboard/offers', '/dashboard/brand/offers', '/dashboard/influencer/offers']
const INFLUENCER: NavGroup[] = [
  { items: [{ id: 'home', label: 'Ana Sayfa', href: '/dashboard/influencer', icon: Home, exact: true }] },
  {
    label: 'Çalış',
    items: [
      { id: 'works', label: 'İşler', href: '/dashboard/works', icon: Briefcase, alsoActive: WORKS_ALIASES },
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
      // Önerilenler ve Favoriler/Listeler Keşfet'in sekmeleri (docs/REDESIGN.md).
      {
        id: 'discover',
        label: 'Keşfet',
        href: '/dashboard/brand/discover',
        icon: Compass,
        alsoActive: ['/dashboard/brand/ai', '/dashboard/brand/favorites', '/dashboard/brand/inflist'],
      },
      { id: 'adverts', label: 'İlanlar', href: '/dashboard/brand/advert', icon: Megaphone },
    ],
  },
  {
    label: 'Çalış',
    items: [
      { id: 'works', label: 'İşler', href: '/dashboard/works', icon: Briefcase, alsoActive: WORKS_ALIASES },
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
  { items: [{ id: 'admin', label: 'Kullanıcılar', href: '/admin', icon: Users, exact: true }] },
  {
    label: 'Destek',
    items: [
      { id: 'support', label: 'Destek Talepleri', href: '/admin/support', icon: LifeBuoy },
      { id: 'feedback', label: 'Geri Bildirimler', href: '/admin/feedback', icon: MessagesSquare },
      { id: 'reports', label: 'Raporlanan Mesajlar', href: '/admin/messages', icon: Flag },
      { id: 'messages', label: 'Mesajlar', href: '/dashboard/messages', icon: MessageSquare, unread: true },
    ],
  },
  {
    label: 'İçerik',
    items: [
      { id: 'adverts', label: 'İlanlar', href: '/admin/adverts', icon: Megaphone },
      { id: 'notify', label: 'Bildirim Gönder', href: '/admin/notifications', icon: Bell },
    ],
  },
  {
    label: 'Sistem',
    items: [
      { id: 'limits', label: 'Marka Sınırları', href: '/admin/limits', icon: SlidersHorizontal },
      { id: 'api-keys', label: 'API Anahtarları', href: '/admin/api-keys', icon: KeyRound },
      { id: 'manual-connect', label: 'Manuel Instagram Bağlama', href: '/admin/manual-connect', icon: Link2 },
    ],
  },
]

export const NAV: Record<ShellRole, NavGroup[]> = { influencer: INFLUENCER, brand: BRAND, admin: ADMIN }

/** Mobil alt sekme çubuğundaki maddeler (sonuncusu her zaman "Menü"). */
export const MOBILE_TABS: Record<ShellRole, string[]> = {
  influencer: ['home', 'works', 'adverts', 'messages'],
  brand: ['home', 'discover', 'works', 'messages'],
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
