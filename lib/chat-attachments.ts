// R2'deki sohbet görselleri için görüntüleme bağlantısı (2026-11-24). Kova gizli; yalnızca odanın tarafları 12 saatlik imzalı
// bağlantı alır. Oda üyeliği kullanıcının kendi istemcisiyle (RLS) okunur. Web sunucu aksiyonu ve mobil uç
// (/api/mobile/messages/attachments) aynı fonksiyonu çağırır. Eski Supabase görselleri istemcide imzalanmaya devam eder.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { chatAttachmentFullKey, chatAttachmentR2Key, chatR2KeyParts } from '@/lib/chat-image'
import { createR2ViewUrl } from '@/lib/r2'

const MAX_REFS = 100
// Bağlantı yalnızca erişim içindir; görsel kalıcıdır. Süresi dolan bağlantıyı istemci kendiliğinden yeniler.
const VIEW_TTL_SECONDS = 12 * 60 * 60

/** `r2://chat/...` referanslarını (önizleme) imzalı adreslere çevirir; kullanıcının taraf olmadığı odalarınkiler atlanır. */
export async function signChatAttachmentsAs(
  supabase: SupabaseClient,
  userId: string,
  refs: unknown,
): Promise<Record<string, string>> {
  if (!Array.isArray(refs)) return {}
  const items: { ref: string; key: string; roomId: string }[] = []
  for (const ref of Array.from(new Set(refs.filter((r): r is string => typeof r === 'string'))).slice(0, MAX_REFS)) {
    const key = chatAttachmentR2Key(ref)
    const parts = key ? chatR2KeyParts(key) : null
    if (key && parts) items.push({ ref, key, roomId: parts.roomId })
  }
  if (items.length === 0) return {}

  const roomIds = Array.from(new Set(items.map((i) => i.roomId)))
  const { data: rooms } = await supabase.from('rooms').select('id, brand_id, influencer_id').in('id', roomIds)
  const allowed = new Set(
    (rooms ?? []).filter((r) => r.brand_id === userId || r.influencer_id === userId).map((r) => String(r.id).toLowerCase()),
  )

  const out: Record<string, string> = {}
  await Promise.all(
    items
      .filter((i) => allowed.has(i.roomId))
      .map(async (i) => {
        const url = await createR2ViewUrl(i.key, { expiresSeconds: VIEW_TTL_SECONDS })
        if (url) out[i.ref] = url
      }),
  )
  return out
}

/**
 * "İndir": tam boy dosya (yoksa önizleme) için indirme bağlantısı. Yalnızca odanın tarafları; 10 dakika geçerli.
 */
export async function chatAttachmentDownloadAs(supabase: SupabaseClient, userId: string, ref: unknown): Promise<{ success: true; url: string } | { success: false; error: string }> {
  if (typeof ref !== 'string') return { success: false, error: 'Görsel bulunamadı.' }
  const key = chatAttachmentR2Key(ref)
  const parts = key ? chatR2KeyParts(key) : null
  if (!key || !parts) return { success: false, error: 'Görsel bulunamadı.' }
  const { data: room } = await supabase.from('rooms').select('brand_id, influencer_id').eq('id', parts.roomId).maybeSingle()
  if (!room || (room.brand_id !== userId && room.influencer_id !== userId)) return { success: false, error: 'Görsel bulunamadı.' }
  const target = chatAttachmentFullKey(ref) ?? key
  const ext = target.split('.').pop()
  const url = await createR2ViewUrl(target, { expiresSeconds: 10 * 60, downloadName: `influmatch-gorsel-${Date.now()}.${ext}` })
  return url ? { success: true, url } : { success: false, error: 'Görsel indirilemedi.' }
}
