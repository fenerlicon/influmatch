import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from '../lib/api';

const KEY = 'im_influcash_daily';
// Türkiye takvim günü (UTC+3; web lib/influcash-shared.ts istanbulDay ile aynı).
const istanbulDay = () => new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * Günlük giriş ödülü (Influcash, 2026-11-23): uygulama açılıp ana sayfa görününce İstanbul günü başına bir kez sunucuya sorar.
 * Asıl tekrar kontrolü sunucuda (/api/mobile/influcash/daily). Özellik kapalıysa sessiz.
 */
export default function InflucashDaily() {
    useEffect(() => {
        (async () => {
            const today = istanbulDay();
            try {
                if ((await AsyncStorage.getItem(KEY)) === today) return;
                await AsyncStorage.setItem(KEY, today);
            } catch {
                // Depolama yoksa yine sorulur; sunucu ikinci ödülü yazmaz.
            }
            // Sonuç sessiz: kazanılan puan Influcash ekranında ve bakiyede görünür.
            await apiRequest('influcash/daily', { method: 'POST' });
        })().catch(() => null);
    }, []);
    return null;
}
