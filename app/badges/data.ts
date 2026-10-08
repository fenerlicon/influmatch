import { BadgeCheck, Crown, UserCheck, Megaphone, Zap, Star, TrendingUp, Trophy, Wand2, Building, Rocket, LayoutTemplate, MessageCircleHeart, Gem, Repeat, Globe2, type LucideIcon } from 'lucide-react'

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
    name: 'Mavi Tik',
    description: 'Spotlight üyesi; yüksek takipçili, güven skoru yüksek seçkin içerik üreticisi.',
    icon: BadgeCheck,
    phase: 'mvp',
  },
  {
    id: 'founder-member',
    name: 'Kurucu Üye',
    description: 'Platformun ilk üyelerinden.',
    icon: Crown,
    phase: 'mvp',
  },
  {
    id: 'profile-expert',
    name: 'Profil Uzmanı',
    description: 'Profilini eksiksiz doldurmuş kullanıcı.',
    icon: UserCheck,
    phase: 'mvp',
  },
  {
    id: 'million-club',
    name: 'Milyon Kulübü',
    description: 'Doğrulanmış Instagram veya TikTok hesabında 1 milyon ve üzeri takipçi.',
    icon: Trophy,
    phase: 'mvp',
  },
  {
    id: 'brand-ambassador',
    name: 'Marka Elçisi',
    description: 'Aynı markayla en az 3 kabul edilmiş işbirliği.',
    icon: Megaphone,
    phase: 'mvp',
  },
  {
    id: 'lightning-fast',
    name: 'Hızlı Dönüş',
    description: 'Son 90 günde mesajlara ortalama 2 saatin altında yanıt (en az 5 yanıt).',
    icon: Zap,
    phase: 'mvp',
  },
  // v1.2 (Silver)
  {
    id: 'five-star',
    name: '5 Yıldız',
    description: 'Yüksek puanlı işbirlikleri.',
    icon: Star,
    phase: 'v1.2',
  },
  {
    id: 'trendsetter',
    name: 'Trend Belirleyici',
    description: 'İçerikleri trend olan.',
    icon: TrendingUp,
    phase: 'v1.2',
  },
  // v1.3 (Purple)
  {
    id: 'conversion-wizard',
    name: 'Dönüşüm Sihirbazı',
    description: 'Yüksek dönüşüm oranları.',
    icon: Wand2,
    phase: 'v1.3',
  },
]

export const brandBadges: Badge[] = [
  // MVP (Gold)
  {
    id: 'official-business',
    name: 'Resmi İşletme',
    description: 'Vergi levhası doğrulanmış işletme.',
    icon: Building,
    phase: 'mvp',
  },
  {
    id: 'pioneer-brand',
    name: 'Öncü Marka',
    description: 'Platformun ilk markalarından.',
    icon: Rocket,
    phase: 'mvp',
  },
  {
    id: 'showcase-brand',
    name: 'Vitrin Marka',
    description: 'Örnek kampanya sayfalarına sahip.',
    icon: LayoutTemplate,
    phase: 'mvp',
  },
  {
    id: 'jet-approval',
    name: 'Jet Onay',
    description: 'Başvurulara ortalama 24 saat içinde yanıt (en az 3 başvuru).',
    icon: Zap,
    phase: 'mvp',
  },
  {
    id: 'elite-budget',
    name: 'Elit Bütçe',
    description: '50.000 TL ve üzeri bütçeli ilan veya teklif.',
    icon: Gem,
    phase: 'mvp',
  },
  // v1.2 (Silver)
  {
    id: 'communication-expert',
    name: 'İletişim Uzmanı',
    description: 'Influencerlarla iletişimi güçlü.',
    icon: MessageCircleHeart,
    phase: 'v1.2',
  },
  // v1.3 (Purple)
  {
    id: 'loyal-partner',
    name: 'Sadık Partner',
    description: 'Düzenli işbirliği yapan.',
    icon: Repeat,
    phase: 'v1.3',
  },
  {
    id: 'global',
    name: 'Global',
    description: 'Uluslararası faaliyet gösteren.',
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
    label: 'v1.2',
    color: 'slate',
    borderColor: 'border-slate-400/20',
    bgColor: 'bg-slate-400/5',
    textColor: 'text-slate-400',
    glowColor: 'shadow-[0_0_20px_rgba(148,163,184,0.2)]',
  },
  'v1.3': {
    label: 'v1.3',
    color: 'purple',
    borderColor: 'border-purple-500/20',
    bgColor: 'bg-purple-500/5',
    textColor: 'text-purple-400',
    glowColor: 'shadow-[0_0_20px_rgba(168,85,247,0.2)]',
  },
} as const
