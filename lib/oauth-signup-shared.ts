// Google ile giriş: istemci tarafı yardımcılar (2026-11-24). Sunucu kuralları lib/oauth-signup.ts'de.
// Google'a yönlendirmeden önce kayıt sayfasında seçilen hesap türü (influencer / UGC) ve davet kodu tarayıcıda saklanır;
// onboarding bunları ön doldurur. Onay kutusu onboarding'de ayrıca işaretlenir (kayıt kaydı sunucu saatiyle yazılır).

/** Google ile giriş düğmesi yalnızca Supabase'de Google sağlayıcısı açılınca gösterilir (Vercel: NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true). */
export const GOOGLE_AUTH_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true'

export const OAUTH_SIGNUP_STORAGE_KEY = 'influmatch_oauth_signup'

export interface OAuthSignupIntent {
  creatorType?: 'influencer' | 'ugc'
  inviteCode?: string
}

export function saveOAuthSignupIntent(intent: OAuthSignupIntent) {
  try {
    localStorage.setItem(OAUTH_SIGNUP_STORAGE_KEY, JSON.stringify({ ...intent, at: Date.now() }))
  } catch {}
}

/** Son 1 saat içinde kaydedilmiş niyet; yoksa null. */
export function readOAuthSignupIntent(): OAuthSignupIntent | null {
  try {
    const raw = localStorage.getItem(OAUTH_SIGNUP_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OAuthSignupIntent & { at?: number }
    if (!parsed.at || Date.now() - parsed.at > 60 * 60 * 1000) return null
    return {
      creatorType: parsed.creatorType === 'ugc' || parsed.creatorType === 'influencer' ? parsed.creatorType : undefined,
      inviteCode: typeof parsed.inviteCode === 'string' && /^[A-Z0-9]{6,12}$/.test(parsed.inviteCode) ? parsed.inviteCode : undefined,
    }
  } catch {
    return null
  }
}
