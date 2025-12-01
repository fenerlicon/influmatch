import {
  BadgeCheck,
  Crown,
  UserCheck,
  Megaphone,
  Zap,
  Star,
  TrendingUp,
  Trophy,
  Wand2,
  Building,
  Rocket,
  LayoutTemplate,
  MessageCircleHeart,
  Gem,
  Repeat,
  Globe2,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

export type BadgePhase = 'mvp' | 'v1.2' | 'v1.3'

export interface Badge {
  id: string
  name: string
  description: string
  icon: LucideIcon
  phase: BadgePhase
}

export const influencerBadges: Badge[] = [
  // MVP (Gold)
  {
    id: 'verified-account',
    name: 'Onaylı Hesap',
    description: 'Kimlik doğrulamasını tamamlayanlar',
    icon: BadgeCheck,
    phase: 'mvp',
  },
  {
    id: 'data-verified',
    name: 'Veri Doğrulandı',
    description: 'Instagram verileri doğrulanmış',
    icon: ShieldCheck,
    phase: 'mvp',
  },
  {
    id: 'founder-member',
    name: 'Kurucu Üye',
    description: 'İlk 1000 üye (En prestijli)',
    icon: Crown,
    phase: 'mvp',
  },
  {
    id: 'profile-expert',
    name: 'Profil Uzmanı',
    description: '%100 doluluk oranı',
    icon: UserCheck,
    phase: 'mvp',
  },
  {
    id: 'brand-ambassador',
    name: 'Marka Elçisi',
    description: 'Üye kazandıranlar',
    icon: Megaphone,
    phase: 'mvp',
  },
  // v1.2 (Silver)
  {
    id: 'lightning-fast',
    name: 'Şimşek Hızında',
    description: '30 dk içinde cevap verenler',
    icon: Zap,
    phase: 'v1.2',
  },
  {
    id: 'five-star',
    name: '5 Yıldız',
    description: 'Kusursuz puanlama',
    icon: Star,
    phase: 'v1.2',
  },
  {
    id: 'trendsetter',
    name: 'Trendsetter',
    description: 'Yüksek etkileşim alanlar',
    icon: TrendingUp,
    phase: 'v1.2',
  },
  // v1.3 (Purple)
  {
    id: 'million-club',
    name: 'Milyon Kulübü',
    description: '1M+ takipçisi olanlar',
    icon: Trophy,
    phase: 'v1.3',
  },
  {
    id: 'conversion-wizard',
    name: 'Dönüşüm Sihirbazı',
    description: 'Yüksek satış başarısı',
    icon: Wand2,
    phase: 'v1.3',
  },
]

export const brandBadges: Badge[] = [
  // MVP (Gold)
  {
    id: 'official-business',
    name: 'Resmi İşletme',
    description: 'Kurumsal kimliği doğrulanmış marka',
    icon: Building,
    phase: 'mvp',
  },
  {
    id: 'pioneer-brand',
    name: 'Öncü Marka',
    description: 'İlk katılan vizyoner markalar',
    icon: Rocket,
    phase: 'mvp',
  },
  {
    id: 'showcase-brand',
    name: 'Vitrin Marka',
    description: 'Profili eksiksiz markalar',
    icon: LayoutTemplate,
    phase: 'mvp',
  },
  // v1.2 (Silver)
  {
    id: 'jet-approval',
    name: 'Jet Onay',
    description: 'İşleri bekletmeden onaylayanlar',
    icon: Zap,
    phase: 'v1.2',
  },
  {
    id: 'elite-budget',
    name: 'Elit Bütçe',
    description: 'Yüksek bütçeli teklif verenler',
    icon: Gem,
    phase: 'v1.2',
  },
  {
    id: 'communication-expert',
    name: 'İletişim Uzmanı',
    description: 'Hızlı ve kibar iletişim',
    icon: MessageCircleHeart,
    phase: 'v1.2',
  },
  // v1.3 (Purple)
  {
    id: 'loyal-partner',
    name: 'Sadık Partner',
    description: 'Aynı kişiyle tekrar çalışanlar',
    icon: Repeat,
    phase: 'v1.3',
  },
  {
    id: 'global',
    name: 'Global',
    description: 'Uluslararası kampanya yapanlar',
    icon: Globe2,
    phase: 'v1.3',
  },
]

export const phaseConfig = {
  mvp: {
    label: 'MVP',
    color: 'amber',
    borderColor: 'border-amber-500/30',
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-300',
    glowColor: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]',
  },
  'v1.2': {
    label: 'v1.2 (Yakında)',
    color: 'slate',
    borderColor: 'border-slate-400/20',
    bgColor: 'bg-slate-400/5',
    textColor: 'text-slate-400',
    glowColor: 'shadow-[0_0_20px_rgba(148,163,184,0.2)]',
  },
  'v1.3': {
    label: 'v1.3 (Gelecek Vizyonu)',
    color: 'purple',
    borderColor: 'border-purple-500/20',
    bgColor: 'bg-purple-500/5',
    textColor: 'text-purple-400',
    glowColor: 'shadow-[0_0_20px_rgba(168,85,247,0.2)]',
  },
} as const

