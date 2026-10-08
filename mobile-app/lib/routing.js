import { supabase } from './supabase';

// Girişten sonra kullanıcının gideceği ekran. Web ile aynı kurallar (app/dashboard/layout.tsx):
// - Reddedilmiş hesap panele giremez.
// - Kullanıcı adı veya ad eksikse profil tamamlama (Onboarding).
// - Influencer / UGC, Instagram veya TikTok hesaplarından en az birini doğrulamadan panele giremez.
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
    if (profile.role === 'brand') return 'BrandDashboard';

    const { data: verified } = await supabase
        .from('social_accounts')
        .select('id')
        .eq('user_id', userId)
        .in('platform', ['instagram', 'tiktok'])
        .eq('is_verified', true)
        .limit(1)
        .maybeSingle();
    return verified ? 'Dashboard' : 'SocialVerifyGate';
}

export const REJECTED_MESSAGE = 'Başvurunuz onaylanmadı. Lütfen web sitemizden iletişime geçin.';
