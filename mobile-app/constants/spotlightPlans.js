// Spotlight paketleri: web lib/spotlight-plans.ts ile birebir aynı tutulmalı.
// Fiyatlar ve paket içerikleri iş kararıdır; değiştirmeden önce kullanıcıya sorulur.
// Listede yalnızca sistemde gerçekten çalışan özellikler yer alır. Satın alma kapalı; planları admin açar.

export const SPOTLIGHT_PLAN_PRICES = {
    ibasic: { mo: '149 ₺', yr: '1.490 ₺' },
    ipro: { mo: '299 ₺', yr: '2.990 ₺' },
    mbasic: { mo: '990 ₺', yr: '9.900 ₺' },
    mpro: { mo: '2.490 ₺', yr: '24.900 ₺' },
};

export const SPOTLIGHT_PLAN_FEATURES = {
    ibasic: [
        { text: 'Spotlight rozeti ve çerçevesi', highlight: true },
        { text: 'Keşfette öncelikli listeleme' },
        { text: 'Profil görüntülenme sayıları' },
    ],
    ipro: [
        { text: 'Spotlight rozeti ve çerçevesi', highlight: true },
        { text: 'Keşfette öncelikli listeleme', highlight: true },
        { text: 'Profil görüntülenme sayıları' },
        { text: 'Portföyde iş birliği sonuçları', highlight: true },
    ],
    mbasic: [
        { text: 'Akıllı eşleştirme önerileri', highlight: true },
        { text: 'Kampanya uyum skoru' },
        { text: 'Benzer profil keşfi' },
        { text: 'İlanların topluluk listesinde öne çıkar' },
    ],
    mpro: [
        { text: 'Akıllı eşleştirme önerileri', highlight: true },
        { text: 'Kampanya uyum skoru' },
        { text: 'Benzer profil keşfi' },
        { text: 'İlanların topluluk listesinde öne çıkar' },
        { text: 'Keşifte "Verisi olanlar" ve "Mavi tikli" filtreleri', highlight: true },
        { text: 'Profillerde kampanya ROI analizi', highlight: true },
    ],
};

export const SPOTLIGHT_PLAN_LABELS = {
    ibasic: 'Influencer Basic',
    ipro: 'Influencer Pro',
    mbasic: 'Marka Basic',
    mpro: 'Marka Pro',
};

// Rolün göreceği paketler (web: rol sayfası doğrudan açılır)
export const SPOTLIGHT_PLANS_FOR_ROLE = {
    influencer: ['ibasic', 'ipro'],
    brand: ['mbasic', 'mpro'],
};
