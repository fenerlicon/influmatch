// Google ile kayıt (2026-11-24 kararı: influencer / UGC tarafı için Google ile giriş).
// E-posta kaydında Kullanım Koşulları onayı ve davet kodu kayıt formunda metadata olarak gelir; veritabanı tetikleyicileri
// (record_signup_consent, record_user_invite) bunları yazar. Google ile gelen yeni hesapta bu metadata yoktur: onay ve davet kodu
// profil tamamlama (onboarding) adımında istenir ve burada yazılır. Onay verilmeden profil kaydedilemez, profil tamamlanmadan
// panele girilemez (app/dashboard/layout.tsx), böylece onaysız hesap kalmaz.
//
// "Onay gerekiyor" yalnızca ilk giriş yöntemi e-posta olmayan (yalnızca Google kimliği olan) ve onay kaydı bulunmayan hesaplar için
// true döner; e-postayla kaydolup sonradan Google bağlayan hesaplara yeniden sorulmaz.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient, User } from '@supabase/supabase-js'
import { LEGAL_CONSENT_VERSION } from '@/lib/consent-shared'

const INVITE_CODE_RE = /^[A-Z0-9]{6,12}$/

/** Kullanıcının giriş kimlikleri arasında e-posta/şifre yok ve en az bir OAuth kimliği var mı. */
export function isOAuthOnlyUser(user: Pick<User, 'identities' | 'app_metadata'>): boolean {
  const providers = (user.identities ?? []).map((i) => i.provider)
  if (providers.length === 0) {
    const fromMeta = (user.app_metadata?.providers as string[] | undefined) ?? [user.app_metadata?.provider as string]
    return fromMeta.filter(Boolean).length > 0 && !fromMeta.includes('email')
  }
  return !providers.includes('email')
}

/** Profil tamamlamada Kullanım Koşulları onayı istenmeli mi. */
export async function needsSignupConsent(admin: SupabaseClient, user: Pick<User, 'id' | 'identities' | 'app_metadata'>): Promise<boolean> {
  if (!isOAuthOnlyUser(user)) return false
  const { data, error } = await admin
    .from('consent_records')
    .select('id')
    .eq('user_id', user.id)
    .eq('kind', 'terms_privacy')
    .eq('granted', true)
    .limit(1)
    .maybeSingle()
  if (error) {
    // Tablo yoksa ya da okunamıyorsa onay istenir (yazım aşağıda yine denenir; kayıt engellenmez).
    console.error('[oauth-signup] consent read', error.message)
    return true
  }
  return !data
}

/** Davet kodu geçerli mi (biçim + kayıtlı kod). Kendi kodu sayılmaz. */
export async function resolveInviteCode(admin: SupabaseClient, rawCode: unknown, userId?: string): Promise<{ inviterId: string; code: string } | null> {
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : ''
  if (!INVITE_CODE_RE.test(code)) return null
  const { data } = await admin.from('invite_codes').select('user_id').eq('code', code).maybeSingle()
  const inviterId = (data?.user_id as string | undefined) ?? null
  if (!inviterId || inviterId === userId) return null
  return { inviterId, code }
}

/**
 * Google ile gelen hesabın kayıt adımını tamamlar: onay kaydı (sunucu saatiyle) ve varsa davet kaydı.
 * Davet kaydı veritabanı tetikleyicisiyle aynı kuralla yazılır (davetli başına bir kayıt; kendi kodu sayılmaz).
 */
export async function completeOAuthSignup(
  admin: SupabaseClient,
  userId: string,
  opts: { inviteCode?: string | null; source: 'web' | 'mobile' },
): Promise<void> {
  const { error: consentError } = await admin.from('consent_records').insert({
    user_id: userId,
    kind: 'terms_privacy',
    granted: true,
    version: LEGAL_CONSENT_VERSION,
    source: opts.source,
  })
  if (consentError) console.error('[oauth-signup] consent insert', consentError.message)

  const invite = await resolveInviteCode(admin, opts.inviteCode, userId)
  if (invite) {
    const { error } = await admin
      .from('user_invites')
      .upsert({ invitee_id: userId, inviter_id: invite.inviterId, code: invite.code }, { onConflict: 'invitee_id', ignoreDuplicates: true })
    if (error) console.error('[oauth-signup] invite insert', error.message)
  }
}
