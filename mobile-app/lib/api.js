import { supabase } from './supabase';

// Web sunucusunun adresi. Geliştirmede yerel sunucuya bağlanmak için mobile-app/.env dosyasına
// EXPO_PUBLIC_API_BASE=http://<bilgisayar-ip>:3000 yazın (.env commit edilmez).
export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE || 'https://influmatch.net').replace(/\/+$/, '');

/**
 * Web'in /api/mobile uçlarına oturum token'ıyla istek atar. Kurallar (yetki, doğrulama, bildirim)
 * sunucuda web ile aynı koddan uygulanır. Hata durumunda { error } döner, istisna fırlatmaz.
 */
export async function apiRequest(path, { method = 'GET', body } = {}) {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return { error: 'Oturumunuz bulunamadı. Lütfen yeniden giriş yapın.' };

        const res = await fetch(`${API_BASE}/api/mobile/${path.replace(/^\/+/, '')}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok && !data.error) return { error: 'Sunucuya ulaşılamadı. Lütfen tekrar deneyin.' };
        return data;
    } catch (e) {
        return { error: 'Bağlantı hatası. İnternetinizi kontrol edin.' };
    }
}
