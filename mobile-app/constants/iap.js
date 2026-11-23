// Mağaza içi satın alma (App Store / Google Play) sabitleri. Web lib/payments/billing-shared.ts STORE_PRODUCT_IDS ile birebir aynı
// tutulmalı (tests/mobile-parity.test.ts). Ürünler App Store Connect ve Play Console'da bu kimliklerle açılır (docs/PAYMENTS.md).
// Fiyatlar mağazadan gelir (web fiyatından farklı olabilir); burada fiyat yazılmaz.

// Satın alma arayüzü KAPALI: mağaza ürünleri ve geliştirici hesapları hazır olunca, expo-iap kurulup geliştirme derlemesi
// (Expo Go değil) alındıktan sonra true yapılır (lib/iap.js). Sunucuda da admin /admin/billing "Uygulama içi satın alma" açılmalı.
export const IAP_ENABLED = false;

export const STORE_PRODUCT_IDS = {
    ibasic: { mo: 'net.influmatch.app.ibasic.monthly', yr: 'net.influmatch.app.ibasic.yearly' },
    ipro: { mo: 'net.influmatch.app.ipro.monthly', yr: 'net.influmatch.app.ipro.yearly' },
    mbasic: { mo: 'net.influmatch.app.mbasic.monthly', yr: 'net.influmatch.app.mbasic.yearly' },
    mpro: { mo: 'net.influmatch.app.mpro.monthly', yr: 'net.influmatch.app.mpro.yearly' },
};

export const SUBSCRIPTION_SOURCE_LABELS = {
    iyzico: 'Kartla ödeme (web)',
    apple: 'App Store',
    google: 'Google Play',
    admin: 'Yönetici tanımı',
    promo: '0₺ dönemi',
    reward: 'Görev ödülü',
};
