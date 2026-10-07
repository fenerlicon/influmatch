// Hesabın tamamen silinmesi (kullanıcının kendisi veya admin). BU DOSYA 'use server' DEĞİLDİR.
//
// Sıra önemlidir; ara adımda hata olursa hesap yarım kalmamalı:
// 1. Giriş kaydı kilitlenir (ban): silme sürerken veya auth silme başarısız olursa kullanıcı
//    tekrar giriş yapıp dashboard layout'unun yeni profil satırı açmasına yol açamaz.
// 2. Profil satırı silinir (bağlı tablolar CASCADE). Kabul edilmiş başvurusu olan ilan gibi DB
//    kuralları burada durdurur; o durumda kilit geri açılır ve hiçbir şey değişmemiş olur.
// 3. Kullanıcının depodaki dosyaları silinir (KVKK; en iyi çaba).
// 4. Giriş kaydı silinir. Başarısız olursa kullanıcı kilitli kalır (giriş yapamaz).

import type { SupabaseClient } from '@supabase/supabase-js'

const PERMANENT_BAN = '876000h' // ~100 yıl
const USER_FOLDER_BUCKETS = ['avatars', 'tax-documents'] as const

export type AccountDeletionResult = { ok: true; authDeleted: boolean } | { ok: false; error: string }

function isUserNotFound(error: { message?: string; status?: number } | null): boolean {
  if (!error) return false
  return error.status === 404 || /user not found/i.test(error.message ?? '')
}

/** public URL'den (…/storage/v1/object/public/<bucket>/<path>) kova ve yol çıkarır. */
export function storagePathFromPublicUrl(url: string | null | undefined): { bucket: string; path: string } | null {
  if (!url) return null
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?#]+)/)
  if (!match) return null
  return { bucket: match[1], path: decodeURIComponent(match[2]) }
}

async function removeUserFiles(admin: SupabaseClient, userId: string, avatarUrl: string | null) {
  const targets = new Map<string, Set<string>>()
  const add = (bucket: string, path: string) => {
    if (!targets.has(bucket)) targets.set(bucket, new Set())
    targets.get(bucket)!.add(path)
  }

  for (const bucket of USER_FOLDER_BUCKETS) {
    const { data, error } = await admin.storage.from(bucket).list(userId, { limit: 1000 })
    if (error) continue // kova yoksa vb.
    for (const item of data ?? []) {
      if (item.name) add(bucket, `${userId}/${item.name}`)
    }
  }

  // Eski yüklemeler kova köküne rastgele adla yapılmış olabilir; profildeki avatar adresinden bulunur.
  const avatar = storagePathFromPublicUrl(avatarUrl)
  if (avatar && avatar.bucket === 'avatars') add(avatar.bucket, avatar.path)

  for (const [bucket, paths] of Array.from(targets.entries())) {
    const { error } = await admin.storage.from(bucket).remove(Array.from(paths))
    if (error) console.error(`[account-deletion] ${bucket} dosyaları silinemedi:`, error.message)
  }
}

export async function deleteAccountCompletely(admin: SupabaseClient, userId: string): Promise<AccountDeletionResult> {
  // 1. Kilit
  const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: PERMANENT_BAN })
  const authMissing = isUserNotFound(banError)
  if (banError && !authMissing) {
    console.error('[account-deletion] Giriş kaydı kilitlenemedi:', banError.message)
    return { ok: false, error: 'Hesap silinemedi. Lütfen tekrar deneyin.' }
  }

  // 2. Profil
  const { data: profile } = await admin.from('users').select('avatar_url').eq('id', userId).maybeSingle()
  const { error: profileError } = await admin.from('users').delete().eq('id', userId)
  if (profileError) {
    console.error('[account-deletion] Profil silinemedi:', profileError.message)
    if (!authMissing) {
      const { error: unbanError } = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' })
      if (unbanError) console.error('[account-deletion] Kilit geri açılamadı:', unbanError.message)
    }
    // DB kuralının (trigger) mesajı kullanıcıya yöneliktir, ör. kabul edilmiş başvurusu olan ilan.
    const ruleMessage = profileError.code === 'P0001' ? profileError.message : null
    return { ok: false, error: ruleMessage || 'Hesap silinemedi. Lütfen tekrar deneyin.' }
  }

  // 3. Dosyalar
  try {
    await removeUserFiles(admin, userId, (profile?.avatar_url as string | null) ?? null)
  } catch (error) {
    console.error('[account-deletion] Dosya temizliği hatası:', error)
  }

  // 4. Giriş kaydı
  if (authMissing) return { ok: true, authDeleted: true }
  const { error: authError } = await admin.auth.admin.deleteUser(userId)
  if (authError && !isUserNotFound(authError)) {
    console.error('[account-deletion] Giriş kaydı silinemedi, hesap kilitli bırakıldı:', authError.message)
    return { ok: true, authDeleted: false }
  }
  return { ok: true, authDeleted: true }
}
