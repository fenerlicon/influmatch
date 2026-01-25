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
} from 'lucide-react-native';

export const influencerBadges = [
    // MVP (Gold)
    {
        id: 'verified-account',
        name: 'Onaylı Hesap',
        description: 'Kimliği doğrulanmış influencer hesabı.',
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
        id: 'brand-ambassador',
        name: 'Marka Elçisi',
        description: 'Markalarla uzun süreli işbirlikleri yapan.',
        icon: Megaphone,
        phase: 'v1.2',
    },
    // v1.2 (Silver)
    {
        id: 'lightning-fast',
        name: 'Hızlı Dönüş',
        description: 'Mesajlara çok hızlı yanıt veren.',
        icon: Zap,
        phase: 'v1.2',
    },
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
        id: 'million-club',
        name: 'Milyon Kulübü',
        description: 'Milyonlarca erişime sahip.',
        icon: Trophy,
        phase: 'v1.3',
    },
    {
        id: 'conversion-wizard',
        name: 'Dönüşüm Sihirbazı',
        description: 'Yüksek dönüşüm oranları.',
        icon: Wand2,
        phase: 'v1.3',
    },
];

export const brandBadges = [
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
    // v1.2 (Silver)
    {
        id: 'jet-approval',
        name: 'Jet Onay',
        description: 'Başvuruları hızlı onaylayan.',
        icon: Zap,
        phase: 'v1.2',
    },
    {
        id: 'elite-budget',
        name: 'Elit Bütçe',
        description: 'Yüksek bütçeli kampanyalar.',
        icon: Gem,
        phase: 'v1.2',
    },
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
];

export const phaseConfig = {
    mvp: {
        label: 'MVP',
        color: '#f59e0b', // amber-500
        borderColor: 'border-amber-500/30',
        bgColor: 'bg-amber-500/10',
        textColor: 'text-amber-300',
        iconColor: 'text-amber-400',
        glowColor: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]',
        shadowColor: 'rgba(245,158,11,0.3)',
    },
    'v1.2': {
        label: 'v1.2',
        color: '#94a3b8', // slate-400
        borderColor: 'border-slate-400/20',
        bgColor: 'bg-slate-400/5',
        textColor: 'text-slate-400',
        iconColor: 'text-slate-400',
        glowColor: 'shadow-[0_0_20px_rgba(148,163,184,0.2)]',
        shadowColor: 'rgba(148,163,184,0.2)',
    },
    'v1.3': {
        label: 'v1.3',
        color: '#a855f7', // purple-500
        borderColor: 'border-purple-500/20',
        bgColor: 'bg-purple-500/5',
        textColor: 'text-purple-400',
        iconColor: 'text-purple-400',
        glowColor: 'shadow-[0_0_20px_rgba(168,85,247,0.2)]',
        shadowColor: 'rgba(168,85,247,0.2)',
    },
};
