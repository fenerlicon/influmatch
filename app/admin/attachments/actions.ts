'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { storagePathFromPublicUrl } from '@/lib/account-deletion'
import { logPrivacyAccess } from '@/lib/privacy-audit'

// Geri bildirim ve destek talebi ekleri özel (private) kovada tutulur; admin ekranı bunları
// kısa süreli imzalı bağlantı ile açar. Kayıtlarda eski "public" URL biçimi saklı; yol oradan çıkarılır.
// chat-attachments: raporlanan fotoğraflı mesajlar (admin odanın tarafı olmadığı için RLS ile açamaz).
const PRIVATE_ATTACHMENT_BUCKETS = new Set(['feedback-images', 'chat-attachments'])
const SIGNED_URL_TTL_SECONDS = 10 * 60

export async function getAttachmentUrl(storedUrl: string): Promise<{ url?: string; error?: string }> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return { error: 'Bu işlem için yetkiniz yok.' }

  const location = storagePathFromPublicUrl(storedUrl)
  if (!location || !PRIVATE_ATTACHMENT_BUCKETS.has(location.bucket)) {
    return { error: 'Geçersiz dosya bağlantısı.' }
  }

  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sistem yapılandırma hatası.' }

  const { data, error } = await admin.storage.from(location.bucket).createSignedUrl(location.path, SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) return { error: 'Dosya açılamadı.' }
  // Hassas erişim günlüğü (KVKK). Sohbet ekinde yol {oda}/{yükleyen}/… olduğundan yükleyen bilinir.
  const uploader = location.bucket === 'chat-attachments' ? location.path.split('/')[1] : null
  await logPrivacyAccess(admin, {
    actorId: user.id,
    action: 'attachment_view',
    subjectUserId: uploader && /^[0-9a-f-]{36}$/i.test(uploader) ? uploader : null,
    resourceId: `${location.bucket}/${location.path}`,
  })
  return { url: data.signedUrl }
}
