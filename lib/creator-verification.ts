import type { SupabaseClient } from '@supabase/supabase-js'

export const SOCIAL_VERIFICATION_REQUIRED =
  'Devam etmek için Instagram veya TikTok hesabınızdan en az birini doğrulamanız gerekiyor.'

/**
 * Influencer / UGC hesapları Instagram veya TikTok hesaplarından en az birini doğrulamadan panele giremez
 * (web: app/dashboard/layout.tsx). Mobil uçlar da aynı kuralı bu fonksiyonla uygular.
 */
export async function hasVerifiedSocialAccount(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('social_accounts')
    .select('id')
    .eq('user_id', userId)
    .in('platform', ['instagram', 'tiktok'])
    .eq('is_verified', true)
    .limit(1)
    .maybeSingle()
  return !!data
}
