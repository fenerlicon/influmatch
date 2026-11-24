import { supabase } from './supabase';
import { apiRequest } from './api';

// Zorunlu telefon (2026-11-24): numarası olmayan influencer / marka bir kez PhoneGate ekranına gider. Tablo istemciye kapalı;
// durum web sunucusundan okunur. Okunamazsa kapı uygulanmaz (web ile aynı).
async function phoneRoute(fallback) {
    const r = await apiRequest('contact').catch(() => null);
    return r?.success && r.required ? 'PhoneGate' : fallback;
}

// Girişten sonra kullanıcının gideceği ekran. Web ile aynı kurallar (app/dashboard/layout.tsx):
// - Reddedilmiş hesap panele giremez.
// - Kullanıcı adı veya ad eksikse profil tamamlama (Onboarding).
// - Influencer / UGC, Instagram veya TikTok hesaplarından en az birini doğrulamadan panele giremez.
// - Telefon numarası olmayan hesap PhoneGate ekranına gider (2026-11-24).
// Bilgiler veritabanından okunur; kullanıcının değiştirebildiği user_metadata'ya güvenilmez.
export async function resolveHomeRoute(userId) {
    const { data: profile, error } = await supabase
        .from('users')
        .select('role, username, full_name, verification_status')
        .eq('id', userId)
        .maybeSingle();
    if (error) throw error;

    if (profile?.verification_status === 'rejected') return 'Rejected';
    if (!profile?.username || !profile?.full_name) return 'Onboarding';
    if (profile.role === 'brand') return phoneRoute('BrandDashboard');

    const { data: verified } = await supabase
        .from('social_accounts')
        .select('id')
        .eq('user_id', userId)
        .in('platform', ['instagram', 'tiktok'])
        .eq('is_verified', true)
        .limit(1)
        .maybeSingle();
    return verified ? phoneRoute('Dashboard') : 'SocialVerifyGate';
}

export const REJECTED_MESSAGE = 'Hesabınız onaylanmadı. Nedenini görebilir ve itiraz edebilirsiniz.';
