import { Platform } from 'react-native';
import { apiRequest } from './api';
import { IAP_ENABLED } from '../constants/iap';

// Mağaza içi satın alma (App Store / Google Play). Doğrulama ve abonelik kaydı web sunucusunda
// (/api/mobile/billing/verify → lib/payments/store-flow.ts); burada yalnızca satın alma başlatılır ve sonuç sunucuya gönderilir.
//
// BUGÜN KAPALI (constants/iap.js IAP_ENABLED = false): uygulama Expo Go'da çalışmaya devam etsin diye yerel satın alma paketi
// (expo-iap) henüz eklenmedi; yerel modül Expo Go'da yok ve eklenince geliştirme derlemesi (EAS) gerekir.
// Açma adımları (docs/PAYMENTS.md "Mobil"):
//   1. `npx expo install expo-iap` ve app.json "plugins"e "expo-iap"; `eas build --profile development`.
//   2. Aşağıdaki purchaseSubscription içindeki ENTEGRASYON bloğunu açıp IAP_ENABLED = true.
//   3. iOS'ta satın almada appAccountToken = kullanıcı kimliği (UUID), Android'de obfuscatedAccountIdAndroid = kullanıcı kimliği
//      ZORUNLU: sunucu satın almayı bu alanla hesaba bağlar, eşleşmezse reddeder.
//   4. Satın alma başarılı olunca verifyPurchase ile sunucuya gönder; sunucu onaylar (Android acknowledge sunucuda), sonra
//      işlemi bitir (finishTransaction).

export function iapAvailable() {
    return IAP_ENABLED && Platform.OS !== 'web';
}

/** Sunucudan Spotlight hakkı ve satın alma durumu (her kaynaktan; web aboneliği varsa canPurchase false). */
export function fetchBillingStatus() {
    return apiRequest('billing/status');
}

/** Mağaza satın almasını sunucuya doğrulatır. iOS: { platform: 'ios', signedTransaction }, Android: { platform: 'android', purchaseToken }. */
export function verifyPurchase(payload) {
    return apiRequest('billing/verify', { method: 'POST', body: payload });
}

/**
 * Abonelik satın alma. Bugün her zaman { error } döner (IAP kapalı).
 * @param {{ productId: string, userId: string }} input
 */
export async function purchaseSubscription({ productId, userId }) {
    if (!iapAvailable()) return { error: 'Uygulama içi satın alma henüz açık değil.' };
    if (!productId || !userId) return { error: 'Ürün bulunamadı.' };
    // ENTEGRASYON (expo-iap kurulunca; paket adı ve API sürümü kurulumda kontrol edilmeli):
    // const { initConnection, fetchProducts, requestPurchase, finishTransaction } = require('expo-iap');
    // await initConnection();
    // await fetchProducts({ skus: [productId], type: 'subs' });
    // const purchase = await requestPurchase({
    //     request: Platform.OS === 'ios'
    //         ? { ios: { sku: productId, appAccountToken: userId } }
    //         : { android: { skus: [productId], obfuscatedAccountIdAndroid: userId } },
    //     type: 'subs',
    // });
    // const result = await verifyPurchase(Platform.OS === 'ios'
    //     ? { platform: 'ios', signedTransaction: purchase.purchaseToken /* StoreKit 2 JWS */ }
    //     : { platform: 'android', purchaseToken: purchase.purchaseToken });
    // if (!result.error) await finishTransaction({ purchase, isConsumable: false });
    // return result;
    return { error: 'Uygulama içi satın alma henüz açık değil.' };
}
