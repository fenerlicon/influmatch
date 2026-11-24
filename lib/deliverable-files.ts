// Teslimat dosyaları (taslak video / görsel) ve teslim kilidi (SYSTEM_MAP 3.18-N4, 2026-11-24).
//   - Influencer taslağı link yerine dosya olarak da gönderebilir. Dosya Cloudflare R2'ye doğrudan yüklenir (imzalı PUT; Vercel'den
//     ve Supabase Storage'dan geçmez). Anahtar: deliverables/{iş birliği}/{influencer}/{dosya}.
//   - Marka taslağı uygulama içinde önizler (kısa ömürlü, satır içi bağlantı). Orijinal dosyayı indirme (Content-Disposition:
//     attachment) influencer "Ödeme alındı" işaretleyene kadar kilitli; influencer kendi dosyasını her zaman indirebilir.
//     Not: ekran kaydı hiçbir sistemle tamamen engellenemez; amaç doğrudan indirmeyi ve bağlantı paylaşımını önlemek.
//   - Taslağı kaydetme (submit_draft) lib/collaboration-workspace.ts'de; dosya referansı orada doğrulanır (validateDeliverableFileRef).
//
// Web sunucu aksiyonları (app/dashboard/collaborations/[id]/actions.ts) ve mobil uç (/api/mobile/collaborations/[id]/files)
// aynı fonksiyonları çağırır. BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { createR2UploadUrl, createR2ViewUrl, headR2Object, isR2Configured, r2FileStem, r2Ref } from '@/lib/r2'
import {
  DELIVERABLE_FILE_TYPES,
  deliverableFileMaxBytes,
  parseDeliverableFileRef,
} from '@/lib/deliverable-files-shared'
import { DELIVERABLE_KIND_LABELS, type DeliverableKind } from '@/lib/collaboration-workspace-shared'

type Fail = { success?: undefined; error: string }

const UUID_RE = /^[0-9a-f-]{36}$/i
const PREVIEW_TTL_SECONDS = 10 * 60
const DOWNLOAD_TTL_SECONDS = 10 * 60

interface CollabParties {
  id: string
  brand_id: string
  influencer_id: string
  status: string
}

async function loadParties(collaborationId: string): Promise<CollabParties | null> {
  if (!UUID_RE.test(collaborationId)) return null
  const admin = createSupabaseAdminClient()
  if (!admin) return null
  const { data } = await admin.from('collaborations').select('id, brand_id, influencer_id, status').eq('id', collaborationId).maybeSingle()
  return (data as CollabParties | null) ?? null
}

/** R2 açık mı (arayüz dosya yükleme seçeneğini buna göre gösterir). */
export function deliverableFilesEnabled(): boolean {
  return isR2Configured()
}

/**
 * Taslak dosyası için imzalı yükleme adresi. Yalnızca iş birliğinin influencer'ı, anlaşma iki tarafça onaylıyken ve teslimat
 * taslak göndermeye açıkken (bekliyor / taslak gönderildi / revize istendi) alabilir.
 */
export async function createDeliverableUploadAs(
  userId: string,
  collaborationId: string,
  deliverableId: string,
  extension: string,
  size: number,
): Promise<{ success: true; uploadUrl: string; ref: string; contentType: string } | Fail> {
  if (!isR2Configured()) return { error: 'Dosya yükleme şu an kapalı. Taslak linki gönderebilirsiniz.' }
  const type = DELIVERABLE_FILE_TYPES[extension]
  if (!type) return { error: 'Yalnızca video (MP4, MOV, WEBM) veya görsel (JPEG, PNG, WEBP) yükleyebilirsiniz.' }
  if (!Number.isInteger(size) || size <= 0) return { error: 'Geçersiz dosya.' }
  const max = deliverableFileMaxBytes(extension)
  if (size > max) return { error: `Dosya en fazla ${Math.round(max / (1024 * 1024))} MB olabilir.` }

  const collab = await loadParties(collaborationId)
  if (!collab || (collab.brand_id !== userId && collab.influencer_id !== userId)) return { error: 'İş birliği bulunamadı.' }
  if (collab.influencer_id !== userId) return { error: 'Taslağı yalnızca influencer yükleyebilir.' }
  if (!['agreed', 'in_progress'].includes(collab.status)) return { error: 'Bu iş birliğinde teslimat işlemi yapılamaz.' }
  if (!UUID_RE.test(deliverableId)) return { error: 'Teslimat bulunamadı.' }

  const admin = createSupabaseAdminClient()!
  const [{ data: agreement }, { data: deliverable }] = await Promise.all([
    admin.from('collaboration_agreements').select('brand_confirmed_at, influencer_confirmed_at').eq('collaboration_id', collab.id).maybeSingle(),
    admin.from('collaboration_deliverables').select('id, status').eq('id', deliverableId).eq('collaboration_id', collab.id).maybeSingle(),
  ])
  if (!agreement?.brand_confirmed_at || !agreement?.influencer_confirmed_at) {
    return { error: 'Teslimatlar, anlaşma özeti iki tarafça onaylandıktan sonra başlar.' }
  }
  if (!deliverable) return { error: 'Teslimat bulunamadı.' }
  if (!['pending', 'draft_submitted', 'revision_requested'].includes(String(deliverable.status))) {
    return { error: 'Bu teslimat için taslak gönderilemez.' }
  }

  const key = `deliverables/${collab.id.toLowerCase()}/${userId.toLowerCase()}/${r2FileStem()}.${extension}`
  const uploadUrl = await createR2UploadUrl(key, type.contentType, size, 60 * 60)
  if (!uploadUrl) return { error: 'Yükleme başlatılamadı. Tekrar deneyin.' }
  return { success: true, uploadUrl, ref: r2Ref(key), contentType: type.contentType }
}

/**
 * submit_draft öncesi: referans bu iş birliğine ve gönderen influencer'a ait mi, dosya gerçekten yüklenmiş mi, boyut sınırı içinde mi.
 * Geçerliyse R2 anahtarı döner.
 */
export async function validateDeliverableFileRef(ref: string, collaborationId: string, userId: string): Promise<{ key: string } | { error: string }> {
  const parsed = parseDeliverableFileRef(ref)
  if (!parsed || parsed.collaborationId !== collaborationId.toLowerCase() || parsed.uploaderId !== userId.toLowerCase()) {
    return { error: 'Geçersiz dosya.' }
  }
  const head = await headR2Object(parsed.key)
  if (!head) return { error: 'Dosya yüklenemedi. Tekrar deneyin.' }
  if (head.size > deliverableFileMaxBytes(parsed.extension)) return { error: 'Dosya boyut sınırını aşıyor.' }
  return { key: parsed.key }
}

/**
 * Taslak dosyasının bağlantısı. `ref` teslimatın son taslağı ya da taslak geçmişindeki bir dosya olmalı (iş birliğine ait).
 * - view: iki taraf da önizler (satır içi, 10 dakika).
 * - download: influencer her zaman; marka yalnızca influencer "Ödeme alındı" işaretlediyse (teslim kilidi).
 */
export async function deliverableFileUrlAs(
  userId: string,
  collaborationId: string,
  ref: string,
  mode: 'view' | 'download',
): Promise<{ success: true; url: string; kind: 'video' | 'image' } | Fail> {
  const collab = await loadParties(collaborationId)
  if (!collab || (collab.brand_id !== userId && collab.influencer_id !== userId)) return { error: 'İş birliği bulunamadı.' }
  const parsed = parseDeliverableFileRef(ref)
  if (!parsed || parsed.collaborationId !== collab.id.toLowerCase() || parsed.uploaderId !== collab.influencer_id.toLowerCase()) {
    return { error: 'Dosya bulunamadı.' }
  }

  const admin = createSupabaseAdminClient()!
  // Dosya bu iş birliğinin bir taslak kaydında geçmeli (yalnızca gönderilmiş dosyalar açılır).
  const { data: submission } = await admin
    .from('collaboration_submissions')
    .select('id, deliverable_id')
    .eq('collaboration_id', collab.id)
    .eq('file_key', parsed.key)
    .limit(1)
    .maybeSingle()
  if (!submission) return { error: 'Dosya bulunamadı.' }

  const kind = DELIVERABLE_FILE_TYPES[parsed.extension].kind
  if (mode === 'view') {
    const url = await createR2ViewUrl(parsed.key, { expiresSeconds: PREVIEW_TTL_SECONDS })
    return url ? { success: true, url, kind } : { error: 'Dosya açılamadı.' }
  }

  const isBrand = collab.brand_id === userId
  if (isBrand) {
    const { data: payment } = await admin.from('collaboration_payments').select('influencer_received_at').eq('collaboration_id', collab.id).maybeSingle()
    if (!payment?.influencer_received_at) {
      return { error: 'Orijinal dosya, influencer "Ödeme alındı" işaretledikten sonra indirilebilir. Şimdilik önizleyebilirsiniz.' }
    }
  }
  const { data: deliverable } = await admin.from('collaboration_deliverables').select('kind').eq('id', submission.deliverable_id).maybeSingle()
  const label = DELIVERABLE_KIND_LABELS[(deliverable?.kind as DeliverableKind) ?? 'other'] ?? 'Teslimat'
  const url = await createR2ViewUrl(parsed.key, {
    expiresSeconds: DOWNLOAD_TTL_SECONDS,
    downloadName: `influmatch-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${submission.id.slice(0, 8)}.${parsed.extension}`,
  })
  return url ? { success: true, url, kind } : { error: 'Dosya indirilemedi.' }
}
