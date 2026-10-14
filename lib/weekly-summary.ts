// Haftalık özet (influencer/UGC) — "haftalık özette detaylı istatistik" (SYSTEM_MAP 4.3-S7, 3.20-N7; karar 2026-10-14).
// DURUM: yalnızca veri + e-posta görünümü hazır; GÖNDERİM YOK, cron yok. Haftalık e-postalar Resend ücretli planı bekliyor
// (ücretsiz plan günde 100 e-posta; ROADMAP). Gönderim açılana kadar Spotlight paket listesine yazılmaz (yalnızca canlı özellik).
//   - Temel bölüm (herkes): son 7 günde gelen teklifler.
//   - Detaylı bölüm (Influencer Pro): profil görüntülenmeleri (profile_views) ve hafta içinde ölçülen gönderilerin son ölçümleri
//     (lib/post-metrics.ts listDeliverableMetrics; sonuç raporuyla aynı etkileşim hesabı ve etiketleri).
// Önizleme: /admin/weekly-preview?user=<kimlik ya da kullanıcı adı> (yalnızca admin).
// Kişisel veri dışarı gönderilmez; okumalar service role ile, yalnızca sunucuda.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { listDeliverableMetrics } from '@/lib/post-metrics'
import { engagementLabel, formatCount, formatPercent, type EngagementRate, type MetricPlatform } from '@/lib/post-metrics-shared'
import { DELIVERABLE_KIND_LABELS, type DeliverableKind } from '@/lib/collaboration-workspace-shared'
import { resolveSubscriptionTier } from '@/lib/subscription-tier'
import { adminPanelUrl } from '@/lib/email'

const DAY_MS = 24 * 60 * 60 * 1000
const TZ = 'Europe/Istanbul'
const istanbulDate = (date: Date) => date.toLocaleDateString('en-CA', { timeZone: TZ })

export interface WeeklyResultRow {
  deliverable_id: string
  brand_name: string | null
  kind: string
  platform: MetricPlatform
  post_url: string
  views: number | null
  likes: number | null
  comments: number | null
  engagement: EngagementRate | null
  captured_at: string
}

export interface WeeklyCreatorSummary {
  user: { id: string; name: string; username: string | null }
  period: { from: string; to: string }
  /** Detaylı bölüm (Influencer Pro). false iken profileViews ve results hesaplanmaz. */
  detailed: boolean
  pro: boolean
  offers: { received: number; accepted: number; pending: number }
  profileViews: { total: number; brandViewers: number } | null
  results: WeeklyResultRow[] | null
}

/**
 * Bir influencer/UGC için son 7 günün özeti. Influencer değilse null.
 * options.forceDetailed: yalnızca admin önizlemesinde Pro görünümünü denemek için.
 */
export async function buildWeeklyCreatorSummary(
  userId: string,
  options: { now?: Date; forceDetailed?: boolean } = {},
): Promise<WeeklyCreatorSummary | null> {
  const admin = createSupabaseAdminClient()
  if (!admin) throw new Error('Sunucu yapılandırması eksik.')
  const now = options.now ?? new Date()
  const since = new Date(now.getTime() - 7 * DAY_MS)

  const { data: user } = await admin
    .from('users')
    .select('id, full_name, username, role, verification_status, spotlight_active, spotlight_plan, spotlight_expires_at')
    .eq('id', userId)
    .maybeSingle()
  if (!user || user.role !== 'influencer') return null
  const pro = resolveSubscriptionTier(user) === 'SPOTLIGHT_PLUS'
  const detailed = pro || options.forceDetailed === true

  const { data: offerRows, error: offerError } = await admin
    .from('offers')
    .select('status')
    .eq('receiver_user_id', userId)
    .gte('created_at', since.toISOString())
    .limit(1000)
  if (offerError) throw new Error(offerError.message)
  const offers = {
    received: offerRows?.length ?? 0,
    accepted: (offerRows ?? []).filter((o) => o.status === 'accepted').length,
    pending: (offerRows ?? []).filter((o) => o.status === 'pending').length,
  }

  let profileViews: WeeklyCreatorSummary['profileViews'] = null
  let results: WeeklyResultRow[] | null = null
  if (detailed) {
    const since7 = istanbulDate(new Date(now.getTime() - 6 * DAY_MS))
    const { data: views, error: viewError } = await admin
      .from('profile_views')
      .select('viewer_id, viewer_role')
      .eq('profile_id', userId)
      .gte('viewed_on', since7)
      .limit(10000)
    if (viewError) throw new Error(viewError.message)
    profileViews = {
      total: views?.length ?? 0,
      brandViewers: new Set((views ?? []).filter((v) => v.viewer_role === 'brand').map((v) => v.viewer_id as string)).size,
    }

    const { data: collabs, error: collabError } = await admin
      .from('collaborations')
      .select('id, brand_id')
      .eq('influencer_id', userId)
      .neq('status', 'cancelled')
      .limit(500)
    if (collabError) throw new Error(collabError.message)
    const collabIds = (collabs ?? []).map((c) => c.id as string)
    const metrics = (await listDeliverableMetrics(admin, collabIds)).filter((m) => m.latest && m.latest.captured_at >= since.toISOString())
    results = []
    if (metrics.length) {
      const ids = metrics.map((m) => m.deliverable_id)
      const { data: deliverables } = await admin.from('collaboration_deliverables').select('id, collaboration_id, kind').in('id', ids)
      const brandIds = Array.from(new Set((collabs ?? []).map((c) => c.brand_id as string)))
      const { data: brands } = brandIds.length ? await admin.from('users').select('id, full_name').in('id', brandIds) : { data: [] }
      const brandOf = new Map((collabs ?? []).map((c) => [c.id as string, c.brand_id as string]))
      const brandName = new Map((brands ?? []).map((b) => [b.id as string, (b.full_name as string | null) ?? null]))
      const dById = new Map((deliverables ?? []).map((d) => [d.id as string, d]))
      results = metrics
        .map((m) => {
          const d = dById.get(m.deliverable_id)
          return {
            deliverable_id: m.deliverable_id,
            // Kendi özeti: marka adı sahibine her zaman gösterilir (iş birliğinin tarafı).
            brand_name: d ? brandName.get(brandOf.get(d.collaboration_id as string) ?? '') ?? null : null,
            kind: DELIVERABLE_KIND_LABELS[(d?.kind as DeliverableKind) ?? 'other'] ?? DELIVERABLE_KIND_LABELS.other,
            platform: m.platform,
            post_url: m.post_url,
            views: m.latest!.views,
            likes: m.latest!.likes,
            comments: m.latest!.comments,
            engagement: m.engagement,
            captured_at: m.latest!.captured_at,
          }
        })
        .sort((a, b) => b.captured_at.localeCompare(a.captured_at))
    }
  }

  return {
    user: { id: user.id as string, name: (user.full_name as string | null) || (user.username as string | null) || 'Influmatch üyesi', username: (user.username as string | null) ?? null },
    period: { from: since.toISOString(), to: now.toISOString() },
    detailed,
    pro,
    offers,
    profileViews,
    results,
  }
}

// --- E-posta görünümü (gönderim yok) ---------------------------------------------------------------

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

const formatDay = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { timeZone: TZ, day: 'numeric', month: 'long' })

/** Haftalık özet e-postasının konu, düz metin ve HTML hali. Yalnızca ölçülen sayılar; kıyas / tahmin yok. */
export function renderWeeklyCreatorEmail(summary: WeeklyCreatorSummary): { subject: string; text: string; html: string } {
  const period = `${formatDay(summary.period.from)} – ${formatDay(summary.period.to)}`
  const subject = `Haftalık özetin (${period})`
  const dashboard = adminPanelUrl('/dashboard/influencer')
  const lines: string[] = [`Merhaba ${summary.user.name},`, '', `Son 7 günün özeti (${period}):`, '']
  lines.push(`Gelen teklif: ${summary.offers.received} (kabul edilen ${summary.offers.accepted}, yanıt bekleyen ${summary.offers.pending})`)
  if (summary.detailed && summary.profileViews) {
    lines.push(`Profil görüntülenme: ${summary.profileViews.total} (${summary.profileViews.brandViewers} marka)`)
  }
  if (summary.detailed && summary.results) {
    lines.push('', 'Bu hafta ölçülen gönderiler:')
    if (!summary.results.length) lines.push('Bu hafta ölçülen gönderi yok.')
    for (const r of summary.results) {
      const eng = r.engagement ? ` · ${engagementLabel(r.engagement.basis)}: ${formatPercent(r.engagement)}` : ''
      lines.push(`- ${r.brand_name ?? 'İş birliği'} · ${r.kind}: ${formatCount(r.views)} izlenme, ${formatCount(r.likes)} beğeni, ${formatCount(r.comments)} yorum${eng}`)
    }
  }
  lines.push('', `Panel: ${dashboard}`, '', 'E-posta tercihlerini Ayarlar sayfasından değiştirebilirsin.')
  const text = lines.join('\n')

  const cell = 'padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;'
  const stat = (label: string, value: string) =>
    `<td style="padding:12px;border:1px solid #eee;border-radius:8px;"><div style="font-size:12px;color:#666;">${escapeHtml(label)}</div><div style="font-size:20px;font-weight:600;color:#111;">${escapeHtml(value)}</div></td>`
  const stats = [stat('Gelen teklif', String(summary.offers.received)), stat('Kabul edilen', String(summary.offers.accepted))]
  if (summary.detailed && summary.profileViews) {
    stats.push(stat('Profil görüntülenme', String(summary.profileViews.total)), stat('Görüntüleyen marka', String(summary.profileViews.brandViewers)))
  }
  let resultsHtml = ''
  if (summary.detailed && summary.results) {
    const rows = summary.results
      .map((r) => {
        const url = safeHttpUrl(r.post_url)
        const link = url ? ` <a href="${escapeHtml(url)}" style="color:#b08d3c;">Gönderi</a>` : ''
        const eng = r.engagement ? `${escapeHtml(formatPercent(r.engagement))}<div style="font-size:11px;color:#888;">${escapeHtml(engagementLabel(r.engagement.basis))}</div>` : '—'
        return `<tr><td style="${cell}">${escapeHtml(r.brand_name ?? 'İş birliği')}<div style="font-size:11px;color:#888;">${escapeHtml(r.kind)}${link}</div></td><td style="${cell}">${escapeHtml(formatCount(r.views))}</td><td style="${cell}">${escapeHtml(formatCount(r.likes))}</td><td style="${cell}">${escapeHtml(formatCount(r.comments))}</td><td style="${cell}">${eng}</td></tr>`
      })
      .join('')
    resultsHtml = `<h2 style="font-size:16px;margin:24px 0 8px;">Bu hafta ölçülen gönderiler</h2>${
      rows
        ? `<table style="width:100%;border-collapse:collapse;"><tr><th style="${cell}text-align:left;">İş birliği</th><th style="${cell}text-align:left;">İzlenme</th><th style="${cell}text-align:left;">Beğeni</th><th style="${cell}text-align:left;">Yorum</th><th style="${cell}text-align:left;">Etkileşim</th></tr>${rows}</table>`
        : '<p style="font-size:13px;color:#666;">Bu hafta ölçülen gönderi yok.</p>'
    }<p style="font-size:11px;color:#888;">Sayılar gönderilerin herkese açık sayfasından ölçülür.</p>`
  }
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#111;"><div style="max-width:600px;margin:0 auto;background:#fff;padding:24px;"><p style="font-size:12px;letter-spacing:2px;color:#b08d3c;margin:0;">INFLUMATCH</p><h1 style="font-size:20px;margin:8px 0 4px;">Haftalık özetin</h1><p style="font-size:13px;color:#666;margin:0 0 16px;">${escapeHtml(period)} · Merhaba ${escapeHtml(summary.user.name)}</p><table style="width:100%;border-collapse:separate;border-spacing:8px;"><tr>${stats.join('')}</tr></table>${resultsHtml}<p style="margin-top:24px;"><a href="${escapeHtml(dashboard)}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:13px;">Panele git</a></p><p style="font-size:11px;color:#888;margin-top:24px;">E-posta tercihlerini Ayarlar sayfasından değiştirebilirsin.</p></div></body></html>`
  return { subject, text, html }
}
