// Hesabın tamamen silinmesi (kullanıcının kendisi veya admin). BU DOSYA 'use server' DEĞİLDİR.
//
// Sıra önemlidir; ara adımda hata olursa hesap yarım kalmamalı:
// 1. Giriş kaydı kilitlenir (ban): silme sürerken veya auth silme başarısız olursa kullanıcı
//    tekrar giriş yapıp dashboard layout'unun yeni profil satırı açmasına yol açamaz.
// 2. Profil satırı silinir (bağlı tablolar CASCADE). Kabul edilmiş başvurusu olan ilan gibi DB
//    kuralları burada durdurur; o durumda kilit geri açılır ve hiçbir şey değişmemiş olur.
// 3. Kullanıcının depodaki dosyaları silinir (KVKK; en iyi çaba). Dosya listesi profil silinmeden ÖNCE çıkarılır
//    (sohbet odaları, ilanlar, destek/geri bildirim ekleri profille birlikte CASCADE silindiği için sonra bulunamaz).
// 4. Giriş kaydı silinir (social_accounts, user_invites, consent_records auth.users'a CASCADE). Başarısız olursa
//    kullanıcı kilitli kalır (giriş yapamaz).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const PERMANENT_BAN = '876000h' // ~100 yıl
// `{uid}/` klasörüyle saklanan kovalar
const USER_FOLDER_BUCKETS = ['avatars', 'tax-documents', 'task-proofs', 'advert-hero-images'] as const
const LIST_PAGE = 1000
const LIST_MAX = 10000

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

/** Klasördeki dosyaları (bir alt düzey klasörler dahil) sayfalayarak listeler. */
async function listFolderFiles(admin: SupabaseClient, bucket: string, folder: string, depth = 1): Promise<string[]> {
  const paths: string[] = []
  for (let offset = 0; offset < LIST_MAX; offset += LIST_PAGE) {
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: LIST_PAGE, offset })
    if (error || !data) break
    for (const item of data) {
      if (!item.name) continue
      const path = `${folder}/${item.name}`
      // Klasör girdilerinde id yoktur
      if (!item.id) {
        if (depth > 0) paths.push(...(await listFolderFiles(admin, bucket, path, depth - 1)))
      } else {
        paths.push(path)
      }
    }
    if (data.length < LIST_PAGE) break
  }
  return paths
}

type FileTargets = Map<string, Set<string>>

function addTarget(targets: FileTargets, bucket: string, path: string) {
  if (!targets.has(bucket)) targets.set(bucket, new Set())
  targets.get(bucket)!.add(path)
}

/**
 * Silinecek dosyaları profil silinmeden önce toplar:
 * - `{uid}/` klasörleri (avatar, vergi levhası, görev kanıtı, ilan kapağı)
 * - eski kök yüklemeler: profildeki avatar, ilan kapakları
 * - kullanıcının taraf olduğu sohbet odalarının ekleri (`chat-attachments/{oda}/…`; oda CASCADE silinir, ekler sahipsiz kalırdı)
 * - destek talebi ve geri bildirim ekleri (`feedback-images`, kökte rastgele adla)
 */
async function collectUserFiles(admin: SupabaseClient, userId: string, avatarUrl: string | null): Promise<FileTargets> {
  const targets: FileTargets = new Map()

  for (const bucket of USER_FOLDER_BUCKETS) {
    for (const path of await listFolderFiles(admin, bucket, userId, 0)) addTarget(targets, bucket, path)
  }

  const fromUrl = (url: unknown, bucket: string) => {
    const location = storagePathFromPublicUrl(typeof url === 'string' ? url : null)
    if (location && location.bucket === bucket && !location.path.includes('..')) addTarget(targets, bucket, location.path)
  }
  fromUrl(avatarUrl, 'avatars')

  const [rooms, adverts, tickets, feedback] = await Promise.all([
    admin.from('rooms').select('id').or(`brand_id.eq.${userId},influencer_id.eq.${userId}`).limit(5000),
    admin.from('advert_projects').select('hero_image').or(`brand_user_id.eq.${userId},brand_id.eq.${userId}`).limit(5000),
    admin.from('support_tickets').select('file_url').eq('user_id', userId).not('file_url', 'is', null).limit(5000),
    admin.from('feedback_submissions').select('image_url').eq('user_id', userId).not('image_url', 'is', null).limit(5000),
  ])
  for (const row of (adverts.data ?? []) as Array<{ hero_image: string | null }>) fromUrl(row.hero_image, 'advert-hero-images')
  for (const row of (tickets.data ?? []) as Array<{ file_url: string | null }>) fromUrl(row.file_url, 'feedback-images')
  for (const row of (feedback.data ?? []) as Array<{ image_url: string | null }>) fromUrl(row.image_url, 'feedback-images')

  // Sohbet ekleri: {oda}/{gönderen}/{dosya}
  for (const room of (rooms.data ?? []) as Array<{ id: string }>) {
    for (const path of await listFolderFiles(admin, 'chat-attachments', room.id, 1)) addTarget(targets, 'chat-attachments', path)
  }

  return targets
}

async function removeFiles(admin: SupabaseClient, targets: FileTargets) {
  for (const [bucket, paths] of Array.from(targets.entries())) {
    const all = Array.from(paths)
    for (let i = 0; i < all.length; i += 500) {
      const { error } = await admin.storage.from(bucket).remove(all.slice(i, i + 500))
      if (error) console.error(`[account-deletion] ${bucket} dosyaları silinemedi:`, error.message)
    }
  }
}

/**
 * Hesap silme öncesi şifre doğrulaması (web ayarlar + mobil uç). Oturum saklamayan ayrı istemciyle yapılır;
 * çağıranın mevcut oturumu değişmez.
 */
export async function verifyAccountPassword(email: string, password: string): Promise<boolean> {
  if (!email || !password) return false
  const verifier = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await verifier.auth.signInWithPassword({ email, password })
  return !error
}

export async function deleteAccountCompletely(admin: SupabaseClient, userId: string): Promise<AccountDeletionResult> {
  // 1. Kilit
  const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: PERMANENT_BAN })
  const authMissing = isUserNotFound(banError)
  if (banError && !authMissing) {
    console.error('[account-deletion] Giriş kaydı kilitlenemedi:', banError.message)
    return { ok: false, error: 'Hesap silinemedi. Lütfen tekrar deneyin.' }
  }

  // 2. Profil (dosya listesi önce: bağlı kayıtlar profille birlikte silinir)
  const { data: profile } = await admin.from('users').select('avatar_url').eq('id', userId).maybeSingle()
  let files: FileTargets = new Map()
  try {
    files = await collectUserFiles(admin, userId, (profile?.avatar_url as string | null) ?? null)
  } catch (error) {
    console.error('[account-deletion] Dosya listesi çıkarılamadı:', error)
  }
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

  // 3. Dosyalar + auth'a bağlı sosyal hesaplar (auth silinemezse de kalmasın)
  try {
    await removeFiles(admin, files)
  } catch (error) {
    console.error('[account-deletion] Dosya temizliği hatası:', error)
  }
  const { error: socialError } = await admin.from('social_accounts').delete().eq('user_id', userId)
  if (socialError) console.error('[account-deletion] Sosyal hesaplar silinemedi:', socialError.message)

  // 4. Giriş kaydı
  if (authMissing) return { ok: true, authDeleted: true }
  const { error: authError } = await admin.auth.admin.deleteUser(userId)
  if (authError && !isUserNotFound(authError)) {
    console.error('[account-deletion] Giriş kaydı silinemedi, hesap kilitli bırakıldı:', authError.message)
    return { ok: true, authDeleted: false }
  }
  return { ok: true, authDeleted: true }
}
