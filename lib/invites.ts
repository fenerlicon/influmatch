// Davet kodları (Görevler, 2026-10-18): her kullanıcıya kişiye özel kod, kayıt bağlantısı /signup?davet=KOD.
// Kod kayıtta auth user_metadata.invite_code olarak gider; veritabanı tetikleyicisi (record_user_invite) davet kaydını yazar.
// Davet, davet edilen hesap onaylanınca (users.verification_status = 'verified') "doğrulanmış" sayılır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır. Çağıran taraf kullanıcıyı doğrular.

import { randomInt } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Karışan karakterler yok (0/O, 1/I/L). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8
export const INVITE_CODE_RE = /^[A-Z0-9]{6,12}$/

export function normalizeInviteCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return INVITE_CODE_RE.test(code) ? code : null
}

export function inviteLink(code: string) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://influmatch.net').replace(/\/+$/, '')
  return `${base}/signup?davet=${encodeURIComponent(code)}`
}

function randomCode() {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)]
  return out
}

/** Kullanıcının davet kodu; yoksa oluşturur. admin: service role istemcisi. */
export async function ensureInviteCode(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data: existing } = await admin.from('invite_codes').select('code').eq('user_id', userId).maybeSingle()
  if (existing?.code) return existing.code as string
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode()
    const { error } = await admin.from('invite_codes').insert({ user_id: userId, code })
    if (!error) return code
    // Aynı anda iki istek: diğerinin yazdığını oku. Kod çakışması: yeniden dene.
    const { data: again } = await admin.from('invite_codes').select('code').eq('user_id', userId).maybeSingle()
    if (again?.code) return again.code as string
  }
  console.error('[invites] davet kodu oluşturulamadı:', userId)
  return null
}

/** Davet sayıları: toplam kayıt ve onaylanmış (doğrulanmış) hesaplar. */
export async function countInvites(admin: SupabaseClient, userId: string): Promise<{ total: number; verified: number }> {
  const { data: invites, error } = await admin.from('user_invites').select('invitee_id').eq('inviter_id', userId).limit(2000)
  if (error) {
    console.error('[invites] davetler okunamadı:', error.message)
    return { total: 0, verified: 0 }
  }
  const ids = ((invites ?? []) as Array<{ invitee_id: string }>).map((r) => r.invitee_id)
  if (!ids.length) return { total: 0, verified: 0 }
  let verified = 0
  for (let i = 0; i < ids.length; i += 200) {
    const { count } = await admin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .in('id', ids.slice(i, i + 200))
      .eq('verification_status', 'verified')
    verified += count ?? 0
  }
  return { total: ids.length, verified }
}
