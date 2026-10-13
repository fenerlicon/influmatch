// Tasarım tokenları — JS tarafında gereken yerler için (ikon rengi, navigasyon teması, Switch).
// className için tailwind.config.js kullanılır; iki dosya aynı değerleri taşır.
export const colors = {
    bg: '#0C0D10',
    s1: '#121318',
    s2: '#17191F',
    s3: '#1F2129',
    line: 'rgba(255,255,255,0.07)',
    lineStrong: 'rgba(255,255,255,0.13)',
    fg: '#F3F1EC',
    fg2: '#A3A29E',
    fg3: '#6B6B70',
    gold: '#D4AF37',
    goldInk: '#17130A',
    goldSoft: 'rgba(212,175,55,0.10)',
    goldLine: 'rgba(212,175,55,0.32)',
    champagne: '#F7E7CE',
    success: '#5BBF8A',
    warning: '#E3A94B',
    danger: '#E26464',
    info: '#7FA6DB',
};

export const fonts = {
    regular: 'Geist_400Regular',
    medium: 'Geist_500Medium',
    semibold: 'Geist_600SemiBold',
    bold: 'Geist_700Bold',
    display: 'InstrumentSerif_400Regular',
    displayItalic: 'InstrumentSerif_400Regular_Italic',
};

// Lucide ikonları için ortak çizgi kalınlığı
export const ICON_STROKE = 1.75;

// Fotoğrafı olmayan kişiler için baş harf zeminleri (web ile aynı)
export const AVATAR_TONES = ['#2A2433', '#1F2B2A', '#2E2620', '#232838', '#302228', '#262B1F'];
