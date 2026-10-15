// Portföyde iş birliği sonuçları (SYSTEM_MAP 4.3-S7, 3.20-N6; karar 2026-10-14).
//   - Influencer/UGC profilinde "Sonuçlar": tamamlanan iş birliklerinin teslimat türleri, yayın tarihi ve son ölçümleri
//     (sonuç raporuyla aynı hesap: lib/post-metrics.ts listDeliverableMetrics, etkileşim etiketleri aynı).
//   - Başkalarına yalnızca profil sahibi Influencer Pro ise (onaylı + aktif Spotlight + ipro; resolveSubscriptionTier) gösterilir.
//     Kapı gerçek: free_brand_limits_enabled bayrağına bağlı değildir (influencer plan özelliği).
//   - Sahibi her zaman kendi sonuçlarını görür, tek tek gizleyebilir; gizli kayıt başkalarına hiç gönderilmez.
//   - Marka adı yalnızca marka izin verdiyse (brand_portfolio_settings.show_name, varsayılan kapalı); yoksa "Bir marka" + sektör.
//     Gönderi bağlantısı markayı gösterdiği için o durumda başkalarına bağlantı da gönderilmez.
//   - Ücret, anlaşma, iş birliği başlığı ve notlar hiçbir zaman gönderilmez.
// Çağıran, profil erişim kuralını (oturum, marka onayı, keşif çarkı) lib/profile-reads.ts getProfileForViewer ile önceden
// uygulamış olmalıdır; okumalar o kontrolden sonra service role ile yapılır. Tablolar istemcilere tamamen kapalı.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { listDeliverableMetrics } from '@/lib/post-metrics'
import { aggregateEngagement, type DeliverableMetrics } from '@/lib/post-metrics-shared'
import { DELIVERABLE_KIND_LABELS, type DeliverableKind } from '@/lib/collaboration-workspace-shared'
import { resolveSubscriptionTier } from '@/lib/subscription-tier'
import { fetchAccountRole } from '@/lib/viewer-role'
import { BRAND_CATEGORIES } from '@/utils/categories'
import { ANONYMOUS_BRAND_LABEL, type PortfolioItem, type PortfolioPost, type PortfolioView } from '@/lib/portfolio-results-shared'

export * from '@/lib/portfolio-results-shared'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Profilde gösterilen en fazla iş birliği (en yeni tamamlanan önce). */
const PORTFOLIO_LIMIT = 30

type CollabRow = { id: string; brand_id: string; completed_at: string | null; published_at: string | null }
type DeliverableRow = { id: string; collaboration_id: string; position: number; kind: string; publish_url: string | null; published_at: string | null }
type BrandRow = { id: string; full_name: string | null; username: string | null; category: string | null }

function kindLabel(kind: string) {
  return DELIVERABLE_KIND_LABELS[kind as DeliverableKind] ?? DELIVERABLE_KIND_LABELS.other
}

function sectorLabel(category: string | null) {
  if (!category) return null
  return (BRAND_CATEGORIES as Record<string, string>)[category] ?? null
}

/** Profil sahibinin Influencer Pro olup olmadığı (onaylı + aktif Spotlight + ipro). */
export async function isInfluencerPro(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin
    .from('users')
    .select('role, verification_status, spotlight_active, spotlight_plan, spotlight_expires_at')
    .eq('id', userId)
    .maybeSingle()
  return resolveSubscriptionTier(data) === 'SPOTLIGHT_PLUS'
}

/** Markaların "adım görünsün" tercihi (satır yoksa kapalı). */
async function brandNameOptIns(admin: SupabaseClient, brandIds: string[]): Promise<Set<string>> {
  const ids = Array.from(new Set(brandIds.filter((id) => UUID_RE.test(id))))
  if (!ids.length) return new Set()
  const { data, error } = await admin.from('brand_portfolio_settings').select('brand_id, show_name').in('brand_id', ids)
  if (error) {
    console.error('[portfolio] marka tercihleri okunamadı:', error.message)
    return new Set()
  }
  return new Set((data ?? []).filter((row) => row.show_name === true).map((row) => row.brand_id as string))
}

/**
 * Influencer'ın portföy kayıtları. owner = true: gizliler dahil, gerçek marka adı ve bağlantılar.
 * owner = false: gizliler hariç, marka adı / bağlantı yalnızca markanın izniyle.
 */
async function buildPortfolioItems(admin: SupabaseClient, influencerId: string, owner: boolean): Promise<PortfolioItem[]> {
  const { data: collabData, error: collabError } = await admin
    .from('collaborations')
    .select('id, brand_id, completed_at, published_at')
    .eq('influencer_id', influencerId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(PORTFOLIO_LIMIT * 2)
  if (collabError) throw new Error(collabError.message)
  let collabs = (collabData ?? []) as CollabRow[]
  if (!collabs.length) return []

  const { data: hiddenData, error: hiddenError } = await admin
    .from('portfolio_hidden_items')
    .select('collaboration_id')
    .eq('influencer_id', influencerId)
  if (hiddenError) throw new Error(hiddenError.message)
  const hidden = new Set((hiddenData ?? []).map((row) => row.collaboration_id as string))
  if (!owner) collabs = collabs.filter((c) => !hidden.has(c.id))
  if (!collabs.length) return []

  const ids = collabs.map((c) => c.id)
  const { data: deliverableData, error: deliverableError } = await admin
    .from('collaboration_deliverables')
    .select('id, collaboration_id, position, kind, publish_url, published_at')
    .in('collaboration_id', ids)
    .not('publish_url', 'is', null)
    .order('position', { ascending: true })
  if (deliverableError) throw new Error(deliverableError.message)
  const deliverables = (deliverableData ?? []) as DeliverableRow[]

  // Yalnızca yayın linki girilmiş teslimatı olan iş birlikleri portföyde yer alır.
  const withPosts = collabs.filter((c) => deliverables.some((d) => d.collaboration_id === c.id)).slice(0, PORTFOLIO_LIMIT)
  if (!withPosts.length) return []

  const brandIds = Array.from(new Set(withPosts.map((c) => c.brand_id)))
  const [metrics, optIns, brandResult] = await Promise.all([
    listDeliverableMetrics(
      admin,
      withPosts.map((c) => c.id),
    ),
    brandNameOptIns(admin, brandIds),
    admin.from('users').select('id, full_name, username, category').in('id', brandIds),
  ])
  if (brandResult.error) throw new Error(brandResult.error.message)
  const brands = new Map(((brandResult.data ?? []) as BrandRow[]).map((b) => [b.id, b]))
  const metricsById = new Map<string, DeliverableMetrics>(metrics.map((m) => [m.deliverable_id, m]))

  return withPosts.map((c) => {
    const brand = brands.get(c.brand_id) ?? null
    const nameVisible = optIns.has(c.brand_id) && !!brand?.full_name
    const showLinks = owner || nameVisible
    const own = deliverables.filter((d) => d.collaboration_id === c.id)
    const posts: PortfolioPost[] = own.map((d) => {
      const m = metricsById.get(d.id) ?? null
      return {
        deliverable_id: d.id,
        kind: kindLabel(d.kind),
        platform: m?.platform ?? null,
        published_at: d.published_at,
        post_url: showLinks ? d.publish_url : null,
        status: m?.status ?? null,
        latest: m?.latest
          ? { views: m.latest.views, likes: m.latest.likes, comments: m.latest.comments, captured_at: m.latest.captured_at }
          : null,
        engagement: m?.engagement ?? null,
      }
    })
    const measured = own
      .map((d) => metricsById.get(d.id))
      .filter((m): m is DeliverableMetrics => !!m?.latest)
      .map((m) => ({ likes: m.latest!.likes, comments: m.latest!.comments, views: m.latest!.views, followers: m.followers_at_publish }))
    const viewsKnown = measured.filter((p) => p.views !== null)
    const publishedDates = own.map((d) => d.published_at).filter((v): v is string => !!v).sort()
    return {
      collaboration_id: c.id,
      brand: {
        label: nameVisible ? (brand?.full_name as string) : ANONYMOUS_BRAND_LABEL,
        name_visible: nameVisible,
        username: nameVisible ? brand?.username ?? null : null,
        sector: sectorLabel(brand?.category ?? null),
      },
      kinds: Array.from(new Set(own.map((d) => kindLabel(d.kind)))),
      published_at: publishedDates[publishedDates.length - 1] ?? c.published_at,
      completed_at: c.completed_at,
      posts,
      totals: {
        views: viewsKnown.length ? viewsKnown.reduce((sum, p) => sum + (p.views ?? 0), 0) : null,
        likes: measured.reduce((sum, p) => sum + (p.likes ?? 0), 0),
        comments: measured.reduce((sum, p) => sum + (p.comments ?? 0), 0),
        engagement: aggregateEngagement(measured),
        measured: measured.length,
      },
      hidden: owner ? hidden.has(c.id) : false,
      owner_brand_name: owner ? brand?.full_name ?? null : null,
    }
  })
}

/**
 * Profil sayfasındaki "Sonuçlar" bölümü. Çağıran getProfileForViewer ile erişimi doğrulamış olmalı (status 'ok').
 * - Profil influencer değilse null.
 * - Sahibi: her zaman (gizliler dahil) + Pro durumu.
 * - Diğerleri: yalnızca sahibi Influencer Pro ise ve en az bir görünür kayıt varsa; yoksa null (bölüm hiç gösterilmez).
 */
export async function getPortfolioForProfile(
  viewerId: string,
  profile: { id: string; role: string | null },
): Promise<PortfolioView | null> {
  if (profile.role !== 'influencer') return null
  const admin = createSupabaseAdminClient()
  if (!admin) return null
  try {
    const owner = viewerId === profile.id
    const pro = await isInfluencerPro(admin, profile.id)
    if (owner) return { mode: 'owner', items: await buildPortfolioItems(admin, profile.id, true), pro }
    if (!pro) return null
    const items = await buildPortfolioItems(admin, profile.id, false)
    return items.length ? { mode: 'public', items } : null
  } catch (error) {
    console.error('[portfolio] sonuçlar okunamadı:', error)
    return null
  }
}

/** Panel / mobil "Profilim": influencer kendi portföyü (gizliler dahil). Influencer değilse hata. */
export async function getOwnPortfolioAs(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ portfolio: Extract<PortfolioView, { mode: 'owner' }> } | { error: string }> {
  if ((await fetchAccountRole(supabase, userId)) !== 'influencer') return { error: 'Portföy yalnızca influencer/UGC hesaplarında kullanılır.' }
  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sunucu yapılandırması eksik. Lütfen daha sonra tekrar deneyin.' }
  try {
    const [items, pro] = await Promise.all([buildPortfolioItems(admin, userId, true), isInfluencerPro(admin, userId)])
    return { portfolio: { mode: 'owner', items, pro } }
  } catch (error) {
    console.error('[portfolio] kendi portföyü okunamadı:', error)
    return { error: 'Sonuçlar yüklenemedi. Lütfen tekrar deneyin.' }
  }
}

/** Influencer bir iş birliğini portföyünden gizler / yeniden gösterir. Taraf kontrolü: iş birliğinin influencer'ı olmalı. */
export async function setPortfolioItemHiddenAs(
  supabase: SupabaseClient,
  userId: string,
  collaborationId: unknown,
  hidden: unknown,
): Promise<{ success: true; hidden: boolean } | { error: string }> {
  if (typeof collaborationId !== 'string' || !UUID_RE.test(collaborationId)) return { error: 'İş birliği bulunamadı.' }
  if (typeof hidden !== 'boolean') return { error: 'Geçersiz istek.' }
  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sunucu yapılandırması eksik. Lütfen daha sonra tekrar deneyin.' }
  const { data: collab } = await admin.from('collaborations').select('id, influencer_id').eq('id', collaborationId).maybeSingle()
  if (!collab || collab.influencer_id !== userId) return { error: 'İş birliği bulunamadı.' }
  const result = hidden
    ? await admin
        .from('portfolio_hidden_items')
        .upsert({ collaboration_id: collaborationId, influencer_id: userId }, { onConflict: 'collaboration_id', ignoreDuplicates: true })
    : await admin.from('portfolio_hidden_items').delete().eq('collaboration_id', collaborationId).eq('influencer_id', userId)
  if (result.error) {
    console.error('[portfolio] gizleme kaydedilemedi:', result.error.message)
    return { error: 'Kaydedilemedi. Lütfen tekrar deneyin.' }
  }
  return { success: true, hidden }
}

/** Markanın "adım görünsün" tercihi (yalnızca marka; satır yoksa kapalı). */
export async function getBrandPortfolioSettingAs(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ showBrandName: boolean } | { error: string }> {
  if ((await fetchAccountRole(supabase, userId)) !== 'brand') return { error: 'Bu ayar yalnızca marka hesaplarında kullanılır.' }
  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sunucu yapılandırması eksik. Lütfen daha sonra tekrar deneyin.' }
  const { data, error } = await admin.from('brand_portfolio_settings').select('show_name').eq('brand_id', userId).maybeSingle()
  if (error) return { error: 'Ayar okunamadı.' }
  return { showBrandName: data?.show_name === true }
}

export async function setBrandPortfolioSettingAs(
  supabase: SupabaseClient,
  userId: string,
  showBrandName: unknown,
): Promise<{ success: true; showBrandName: boolean } | { error: string }> {
  if (typeof showBrandName !== 'boolean') return { error: 'Geçersiz istek.' }
  if ((await fetchAccountRole(supabase, userId)) !== 'brand') return { error: 'Bu ayar yalnızca marka hesaplarında kullanılır.' }
  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sunucu yapılandırması eksik. Lütfen daha sonra tekrar deneyin.' }
  const { error } = await admin
    .from('brand_portfolio_settings')
    .upsert({ brand_id: userId, show_name: showBrandName, updated_at: new Date().toISOString() }, { onConflict: 'brand_id' })
  if (error) {
    console.error('[portfolio] marka tercihi kaydedilemedi:', error.message)
    return { error: 'Kaydedilemedi. Lütfen tekrar deneyin.' }
  }
  return { success: true, showBrandName }
}
