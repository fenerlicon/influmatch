import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';

// Push bildirimleri: sunucu (lib/notify.ts → lib/push.ts) site içi bildirimle birlikte push gönderir.
// Token sunucu ucundan kaydedilir (/api/mobile/push-token); çıkışta silinir.

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Expo Go'da (Android) push desteklenmiyor; modül yalnızca desteklenen ortamda yüklenir.
const getNotifications = () => {
    if (isExpoGo && Platform.OS === 'android') return null;
    try {
        return require('expo-notifications');
    } catch (e) {
        return null;
    }
};

const Notifications = getNotifications();
if (Notifications) {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });
}

// Push token'ı için EAS proje kimliği gerekir (app.json → expo.extra.eas.projectId, `eas init` ile oluşur).
const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

export async function registerForPushNotificationsAsync() {
    if (!Notifications || !Device.isDevice) return null;
    if (!projectId) {
        console.log('Push devre dışı: EAS proje kimliği tanımlı değil (app.json extra.eas.projectId).');
        return null;
    }

    try {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Bildirimler',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#D4AF37',
            });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') return null;

        return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (error) {
        console.log('Push kaydı başarısız:', error);
        return null;
    }
}

/** Cihaz token'ını oturumdaki kullanıcıya bağlar. */
export async function savePushToken(token) {
    if (!token) return;
    const result = await apiRequest('push-token', { method: 'POST', body: { token } });
    if (result.error) console.log('Push token kaydedilemedi:', result.error);
}

/** Çıkış: önce bu cihazın token'ı hesaptan silinir (bildirimler başka kullanıcıya gitmesin), sonra oturum kapanır. */
export async function signOutAndClearPush() {
    await apiRequest('push-token', { method: 'POST', body: { token: null } }).catch(() => null);
    await supabase.auth.signOut();
}

/**
 * Bildirime dokununca açılacak ekran. Sunucudaki bağlantılar web yollarıdır; mobil sekmelere çevrilir.
 * role: 'brand' | 'influencer'
 */
export function routeForLink(link, role) {
    if (!link || typeof link !== 'string') return null;
    const root = role === 'brand' ? 'BrandDashboard' : 'Dashboard';
    const roomMatch = link.match(/[?&]roomId=([0-9a-f-]+)/i);
    if (roomMatch) return { name: root, params: { screen: 'Mesajlar', params: { openRoomId: roomMatch[1] } } };
    const collabMatch = link.match(/\/collaborations\/([0-9a-f-]{36})/i);
    if (collabMatch) return { name: 'CollaborationDetail', params: { id: collabMatch[1] } };
    if (link.includes('/collaborations')) return { name: 'Collaborations' };
    if (link.includes('/offers')) return { name: root, params: { screen: 'Teklifler' } };
    if (link.includes('/advert')) return { name: root, params: { screen: role === 'brand' ? 'BrandAdverts' : 'İlanlar' } };
    if (link.includes('/badges')) return { name: role === 'brand' ? root : 'Badges', params: role === 'brand' ? { screen: 'Profil' } : undefined };
    if (link.includes('/profile') || link.includes('/settings')) return { name: root, params: { screen: 'Profil' } };
    return { name: root, params: { screen: 'Ana Sayfa' } };
}

/** Bildirime dokunma dinleyicisi. Uygulama kapalıyken açılan bildirim de işlenir. Dinleyiciyi kaldıran fonksiyon döner. */
export function listenForNotificationTaps(onLink) {
    if (!Notifications) return () => {};
    const handle = (response) => {
        const link = response?.notification?.request?.content?.data?.link;
        if (link) onLink(link);
    };
    Notifications.getLastNotificationResponseAsync?.().then(handle).catch(() => null);
    const subscription = Notifications.addNotificationResponseReceivedListener(handle);
    return () => subscription.remove();
}
