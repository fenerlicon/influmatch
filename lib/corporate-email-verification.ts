// Kurumsal e-posta kodla doğrulama (sunucu tarafı).
//
// Kod 6 hanelidir, 15 dakika geçerlidir, en fazla 5 yanlış deneme yapılabilir; yeniden gönderim
// 60 saniye arayla ve günde en fazla 5 kez yapılabilir. Veritabanında kodun kendisi değil özeti tutulur.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import { createHash, randomInt, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { validateCorporateEmail } from '@/lib/corporate-email'
import { sendEmail } from '@/lib/email'
import { syncOfficialBusiness } from '@/lib/official-business'

const CODE_TTL_MS = 15 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000
const MAX_SENDS_PER_DAY = 5
const MAX_ATTEMPTS = 5
const DAY_MS = 24 * 60 * 60 * 1000

export type CorporateEmailResult = { success: true; message: string } | { success: false; error: string }

const hashCode = (userId: string, code: string) => createHash('sha256').update(`${userId}:${code}`).digest('hex')

async function loadBrand(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from('users')
    .select('role, social_links, corporate_email, corporate_email_verified_at')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) throw new Error('Profil bulunamadı.')
  if (data.role !== 'brand') throw new Error('Bu işlem sadece markalar içindir.')
  return data as {
    role: string
    social_links: Record<string, string | null> | null
    corporate_email: string | null
    corporate_email_verified_at: string | null
  }
}

/** Kurumsal e-postayı kaydeder (değiştiyse doğrulama ve sarı tik düşer). Kod göndermez. */
export async function saveCorporateEmail(admin: SupabaseClient, userId: string, email: string): Promise<CorporateEmailResult> {
  const brand = await loadBrand(admin, userId)
  const validation = validateCorporateEmail(email, brand.social_links?.website)
  if (!validation.isValid) return { success: false, error: validation.error }

  if (validation.email === brand.corporate_email && brand.corporate_email_verified_at) {
    return { success: true, message: 'Kurumsal e-postanız zaten doğrulanmış.' }
  }

  const { error } = await admin
    .from('users')
    .update({ corporate_email: validation.email, corporate_email_verified_at: null })
    .eq('id', userId)
  if (error) return { success: false, error: `Kurumsal e-posta kaydedilemedi: ${error.message}` }

  await admin.from('corporate_email_verifications').delete().eq('user_id', userId)
  await syncOfficialBusiness(admin, userId)
  return { success: true, message: 'Kurumsal e-posta kaydedildi.' }
}

export async function sendCorporateEmailCode(admin: SupabaseClient, userId: string): Promise<CorporateEmailResult> {
  const brand = await loadBrand(admin, userId)
  if (!brand.corporate_email) return { success: false, error: 'Önce kurumsal e-postanızı kaydedin.' }
  if (brand.corporate_email_verified_at) return { success: true, message: 'Kurumsal e-postanız zaten doğrulanmış.' }

  const validation = validateCorporateEmail(brand.corporate_email, brand.social_links?.website)
  if (!validation.isValid) return { success: false, error: validation.error }

  const { data: pending } = await admin.from('corporate_email_verifications').select('*').eq('user_id', userId).maybeSingle()
  const now = Date.now()
  let sendCount = 1
  let windowStart = new Date(now).toISOString()
  if (pending) {
    if (now - new Date(pending.sent_at).getTime() < RESEND_COOLDOWN_MS) {
      return { success: false, error: 'Yeni kod istemeden önce 1 dakika bekleyin.' }
    }
    const windowActive = now - new Date(pending.send_window_started_at).getTime() < DAY_MS
    if (windowActive && pending.send_count >= MAX_SENDS_PER_DAY) {
      return { success: false, error: 'Bugün için kod gönderim sınırına ulaştınız. Lütfen yarın tekrar deneyin.' }
    }
    if (windowActive) {
      sendCount = pending.send_count + 1
      windowStart = pending.send_window_started_at
    }
  }

  const code = String(randomInt(100000, 1000000))
  const { error } = await admin.from('corporate_email_verifications').upsert(
    {
      user_id: userId,
      email: validation.email,
      code_hash: hashCode(userId, code),
      expires_at: new Date(now + CODE_TTL_MS).toISOString(),
      attempts: 0,
      sent_at: new Date(now).toISOString(),
      send_count: sendCount,
      send_window_started_at: windowStart,
    },
    { onConflict: 'user_id' },
  )
  if (error) return { success: false, error: `Kod oluşturulamadı: ${error.message}` }

  const result = await sendEmail({
    to: [validation.email],
    subject: `Influmatch kurumsal e-posta doğrulama kodu: ${code}`,
    text: [
      'Merhaba,',
      '',
      `Influmatch marka hesabınız için kurumsal e-posta doğrulama kodunuz: ${code}`,
      '',
      'Kod 15 dakika geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı dikkate almayın.',
      '',
      'Influmatch',
    ].join('\n'),
  })
  if (!result.sent) {
    console.error('[corporate-email] Kod gönderilemedi:', result.reason)
    if (result.code === 'quota_exceeded') {
      return { success: false, error: 'E-posta gönderim limitimiz bugünlük doldu. Lütfen yarın tekrar deneyin.' }
    }
    return { success: false, error: 'Doğrulama e-postası gönderilemedi. Lütfen daha sonra tekrar deneyin.' }
  }
  return { success: true, message: `Doğrulama kodu ${validation.email} adresine gönderildi.` }
}

export async function verifyCorporateEmailCode(admin: SupabaseClient, userId: string, rawCode: string): Promise<CorporateEmailResult> {
  const code = rawCode.replace(/\s/g, '')
  if (!/^\d{6}$/.test(code)) return { success: false, error: 'Kod 6 haneli olmalı.' }

  const brand = await loadBrand(admin, userId)
  const { data: pending } = await admin.from('corporate_email_verifications').select('*').eq('user_id', userId).maybeSingle()
  if (!pending || pending.email !== brand.corporate_email) return { success: false, error: 'Geçerli bir kod bulunamadı. Yeni kod isteyin.' }
  if (new Date(pending.expires_at).getTime() < Date.now()) return { success: false, error: 'Kodun süresi doldu. Yeni kod isteyin.' }
  if (pending.attempts >= MAX_ATTEMPTS) return { success: false, error: 'Çok fazla hatalı deneme. Yeni kod isteyin.' }

  const expected = Buffer.from(pending.code_hash, 'hex')
  const actual = Buffer.from(hashCode(userId, code), 'hex')
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    await admin.from('corporate_email_verifications').update({ attempts: pending.attempts + 1 }).eq('user_id', userId)
    return { success: false, error: `Kod hatalı. Kalan deneme: ${MAX_ATTEMPTS - pending.attempts - 1}` }
  }

  const validation = validateCorporateEmail(pending.email, brand.social_links?.website)
  if (!validation.isValid) return { success: false, error: validation.error }

  const { error } = await admin.from('users').update({ corporate_email_verified_at: new Date().toISOString() }).eq('id', userId)
  if (error) return { success: false, error: `Doğrulama kaydedilemedi: ${error.message}` }
  await admin.from('corporate_email_verifications').delete().eq('user_id', userId)

  const badge = await syncOfficialBusiness(admin, userId)
  return {
    success: true,
    message:
      badge === 'granted'
        ? 'Kurumsal e-postanız doğrulandı ve "Resmi İşletme" rozetiniz verildi.'
        : 'Kurumsal e-postanız doğrulandı. Vergi levhanız onaylandığında "Resmi İşletme" rozeti verilecek.',
  }
}
