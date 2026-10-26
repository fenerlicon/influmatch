// "Verilerimi indir" (KVKK md. 11 erişim hakkı; SYSTEM_MAP 14). BU DOSYA 'use server' DEĞİLDİR; yalnızca sunucuda.
//
// Kullanıcının KENDİ verisini tek bir JSON belgesinde toplar. Service role ile okunur; bu yüzden her sorgu
// yalnızca çağıranın kimliğiyle süzülür (`.eq(<sahip kolonu>, userId)`), başka kullanıcının kişisel verisi eklenmez:
// - Mesajlarda yalnızca kullanıcının YAZDIĞI mesajlar; karşı tarafın mesajları yalnızca sayı olarak.
// - Markanın ilanlarına gelen başvurular, profil görüntüleyenler, davet edilenler: yalnızca sayı.
// - Başka kullanıcılar yalnızca kimlik (uuid) ile anılır (favoriler, engellenenler, oda karşı tarafı).
// - İç kayıtlar dışarıda: admin notları, doğrulama kodları/hash'leri, inceleyen admin kimliği, kazıma kilitleri.
// Web: GET /api/account/export (çerez oturumu), mobil: GET /api/mobile/account/export (Bearer). Hız sınırı uçlarda.

import type { SupabaseClient, User } from '@supabase/supabase-js'
import { DATA_EXPORT_COOLDOWN_MINUTES } from '@/lib/consent-shared'
import { lastPrivacyActionAt, logPrivacyAccess } from '@/lib/privacy-audit'

const ROW_LIMIT = 5000
// Günlük tablosu yoksa (SQL çalıştırılmadıysa) aynı sunucu örneğinde bellek içi sınır.
const memoryLastExport = new Map<string, number>()

/**
 * Hız sınırı + günlük + dışa aktarım. `retryAfterMinutes` doluysa istek reddedilir.
 * Kayıt (data_export) dosya üretilmeden önce yazılır; aynı anda gelen iki istek ikisini de üretse bile sınır sonraki isteği durdurur.
 */
export async function exportUserData(
  admin: SupabaseClient,
  user: User,
): Promise<{ data: Awaited<ReturnType<typeof buildUserDataExport>> } | { retryAfterMinutes: number }> {
  const cooldownMs = DATA_EXPORT_COOLDOWN_MINUTES * 60 * 1000
  const last = await lastPrivacyActionAt(admin, user.id, 'data_export')
  const lastMs = last === undefined ? memoryLastExport.get(user.id) ?? null : last?.getTime() ?? null
  if (lastMs !== null && Date.now() - lastMs < cooldownMs) {
    return { retryAfterMinutes: Math.max(1, Math.ceil((cooldownMs - (Date.now() - lastMs)) / 60000)) }
  }
  memoryLastExport.set(user.id, Date.now())
  await logPrivacyAccess(admin, { actorId: user.id, subjectUserId: user.id, action: 'data_export' })
  return { data: await buildUserDataExport(admin, user) }
}

/** İndirilen dosyanın adı: influmatch-verilerim-YYYY-AA-GG.json */
export function dataExportFileName(date = new Date()) {
  return `influmatch-verilerim-${date.toISOString().slice(0, 10)}.json`
}

type Section = unknown[] | { error: string } | { truncated: true; rows: unknown[] }

/** Sorgu sonucunu bölüm değerine çevirir (hata kullanıcıya ayrıntısız). */
function section(result: { data: unknown[] | null; error: { message: string } | null }): Section {
  if (result.error) return { error: 'Bu bölüm okunamadı.' }
  const rows = result.data ?? []
  return rows.length >= ROW_LIMIT ? { truncated: true, rows } : rows
}

function omit<T extends Record<string, unknown>>(rows: T[] | null | undefined, keys: string[]): Record<string, unknown>[] {
  return (rows ?? []).map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key))))
}

async function countOf(query: PromiseLike<{ count: number | null; error: unknown }>): Promise<number | null> {
  const { count, error } = await query
  return error ? null : count ?? 0
}

async function listFolder(admin: SupabaseClient, bucket: string, folder: string): Promise<string[] | { error: string }> {
  const names: string[] = []
  for (let offset = 0; offset < 5000; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 1000, offset })
    if (error) return offset === 0 ? [] : names
    for (const item of data ?? []) if (item.name) names.push(`${bucket}/${folder}/${item.name}`)
    if (!data || data.length < 1000) break
  }
  return names
}

export async function buildUserDataExport(admin: SupabaseClient, user: User) {
  const userId = user.id

  // Önce kullanıcıya ait kimlikler (sonraki sorgular bunlarla süzülür).
  const [roomsRes, collabsRes, advertsRes, listsRes, socialRes] = await Promise.all([
    admin.from('rooms').select('id, offer_id, advert_application_id, brand_id, influencer_id, created_at').or(`brand_id.eq.${userId},influencer_id.eq.${userId}`).limit(ROW_LIMIT),
    admin.from('collaborations').select('*').or(`brand_id.eq.${userId},influencer_id.eq.${userId}`).limit(ROW_LIMIT),
    admin.from('advert_projects').select('*').or(`brand_user_id.eq.${userId},brand_id.eq.${userId}`).limit(ROW_LIMIT),
    admin.from('favorite_lists').select('*').eq('brand_id', userId).limit(ROW_LIMIT),
    admin.from('social_accounts').select('*').eq('user_id', userId).limit(50),
  ])

  const rooms = (roomsRes.data ?? []) as Array<{ id: string; brand_id: string; influencer_id: string }>
  const roomIds = rooms.map((room) => room.id)
  const collabIds = ((collabsRes.data ?? []) as Array<{ id: string }>).map((row) => row.id)
  const advertIds = ((advertsRes.data ?? []) as Array<{ id: string }>).map((row) => row.id)
  const listIds = ((listsRes.data ?? []) as Array<{ id: string }>).map((row) => row.id)
  const socialIds = ((socialRes.data ?? []) as Array<{ id: string }>).map((row) => row.id)
  const inIds = (ids: string[]) => (ids.length ? ids.slice(0, 1000) : ['00000000-0000-0000-0000-000000000000'])

  const [
    profileRes,
    offersRes,
    myMessagesRes,
    applicationsRes,
    notificationsRes,
    supportRes,
    feedbackRes,
    favoritesRes,
    listItemsRes,
    savedAdvertsRes,
    advertAlertsRes,
    templatesRes,
    rateCardRes,
    campaignsRes,
    badgesRes,
    taxRes,
    blocksRes,
    reportsRes,
    dismissedRes,
    activityRes,
    tasksRes,
    rewardsRes,
    inviteCodeRes,
    portfolioHiddenRes,
    brandPortfolioRes,
    spinsRes,
    viewsGivenRes,
    analyticsRes,
    consentRes,
    accessLogRes,
    agreementsRes,
    deliverablesRes,
    submissionsRes,
    paymentsRes,
    historyRes,
    receivedMessages,
    applicationsToMyAdverts,
    profileViewsReceived,
    invitedCount,
  ] = await Promise.all([
    admin.from('users').select('*').eq('id', userId).maybeSingle(),
    admin.from('offers').select('*').or(`sender_user_id.eq.${userId},receiver_user_id.eq.${userId}`).limit(ROW_LIMIT),
    admin.from('messages').select('id, room_id, content, created_at').eq('sender_id', userId).order('created_at').limit(ROW_LIMIT),
    admin.from('advert_applications').select('*').eq('influencer_user_id', userId).limit(ROW_LIMIT),
    admin.from('notifications').select('title, message, type, is_read, link, created_at').eq('user_id', userId).order('created_at').limit(ROW_LIMIT),
    admin.from('support_tickets').select('id, subject, priority, message, file_url, status, admin_response, created_at, updated_at').eq('user_id', userId).limit(ROW_LIMIT),
    admin.from('feedback_submissions').select('id, role, description, image_url, status, created_at').eq('user_id', userId).limit(ROW_LIMIT),
    admin.from('favorites').select('influencer_id, list_id, created_at').eq('brand_id', userId).limit(ROW_LIMIT),
    admin.from('favorite_list_items').select('list_id, influencer_id, created_at').in('list_id', inIds(listIds)).limit(ROW_LIMIT),
    admin.from('saved_adverts').select('*').eq('user_id', userId).limit(ROW_LIMIT),
    admin.from('advert_alerts').select('*').eq('user_id', userId).limit(ROW_LIMIT),
    admin.from('offer_templates').select('*').eq('brand_id', userId).limit(ROW_LIMIT),
    admin.from('rate_cards').select('*').eq('user_id', userId).limit(1),
    admin.from('campaigns').select('*').eq('brand_id', userId).limit(ROW_LIMIT),
    admin.from('user_badges').select('badge_id, earned_at').eq('user_id', userId).limit(ROW_LIMIT),
    admin
      .from('tax_verifications')
      .select('id, file_path, file_type, status, submitted_tax_id, submitted_legal_name, submitted_tax_office, submitted_city, extracted, reasons, review_note, reviewed_at, created_at, updated_at')
      .eq('user_id', userId)
      .limit(ROW_LIMIT),
    admin.from('user_blocks').select('blocked_user_id, created_at').eq('blocker_user_id', userId).limit(ROW_LIMIT),
    admin.from('message_reports').select('id, reason, description, status, reviewed_at, created_at').eq('reporter_user_id', userId).limit(ROW_LIMIT),
    admin.from('dismissed_offers').select('offer_id, created_at').eq('user_id', userId).limit(ROW_LIMIT),
    admin.from('user_activity').select('last_seen_at').eq('user_id', userId).limit(1),
    admin.from('task_submissions').select('*').eq('user_id', userId).limit(ROW_LIMIT),
    admin.from('task_rewards').select('*').eq('user_id', userId).limit(ROW_LIMIT),
    admin.from('invite_codes').select('code, created_at').eq('user_id', userId).limit(1),
    admin.from('portfolio_hidden_items').select('collaboration_id, hidden_at').eq('influencer_id', userId).limit(ROW_LIMIT),
    admin.from('brand_portfolio_settings').select('show_name, updated_at').eq('brand_id', userId).limit(1),
    admin.from('discovery_spins').select('id, created_at, expires_at').eq('brand_id', userId).limit(ROW_LIMIT),
    admin.from('profile_views').select('profile_id, viewed_on').eq('viewer_id', userId).limit(ROW_LIMIT),
    admin.from('analytics_events').select('event_type, target_id, created_at').eq('actor_id', userId).limit(ROW_LIMIT),
    admin.from('consent_records').select('kind, granted, version, source, created_at').eq('user_id', userId).order('created_at').limit(ROW_LIMIT),
    admin.from('privacy_audit_log').select('action, created_at').eq('subject_user_id', userId).order('created_at').limit(ROW_LIMIT),
    admin.from('collaboration_agreements').select('*').in('collaboration_id', inIds(collabIds)).limit(ROW_LIMIT),
    admin.from('collaboration_deliverables').select('*').in('collaboration_id', inIds(collabIds)).limit(ROW_LIMIT),
    admin.from('collaboration_submissions').select('id, collaboration_id, deliverable_id, url, note, review, review_note, reviewed_at, created_at').in('collaboration_id', inIds(collabIds)).limit(ROW_LIMIT),
    admin.from('collaboration_payments').select('*').in('collaboration_id', inIds(collabIds)).limit(ROW_LIMIT),
    admin.from('social_account_history').select('*').in('social_account_id', inIds(socialIds)).order('recorded_at').limit(ROW_LIMIT),
    countOf(admin.from('messages').select('id', { count: 'exact', head: true }).in('room_id', inIds(roomIds)).neq('sender_id', userId)),
    countOf(admin.from('advert_applications').select('id', { count: 'exact', head: true }).in('advert_id', inIds(advertIds))),
    countOf(admin.from('profile_views').select('id', { count: 'exact', head: true }).eq('profile_id', userId)),
    countOf(admin.from('user_invites').select('invitee_id', { count: 'exact', head: true }).eq('inviter_id', userId)),
  ])

  const [avatarFiles, taxFiles, proofFiles, heroFiles] = await Promise.all([
    listFolder(admin, 'avatars', userId),
    listFolder(admin, 'tax-documents', userId),
    listFolder(admin, 'task-proofs', userId),
    listFolder(admin, 'advert-hero-images', userId),
  ])

  // Profil: iç alanlar (admin notu) ve cihaz anahtarı dışarıda; push kaydı yalnızca var/yok.
  const profileRow = (profileRes.data ?? null) as Record<string, unknown> | null
  const profile = profileRow
    ? {
        ...Object.fromEntries(Object.entries(profileRow).filter(([key]) => !['admin_notes', 'push_token'].includes(key))),
        push_notifications_registered: !!profileRow.push_token,
      }
    : null

  return {
    format: 'influmatch-data-export',
    version: 1,
    generated_at: new Date().toISOString(),
    notes: [
      'Bu dosya hesabınıza ait verilerin bir kopyasıdır.',
      'Başka kullanıcılar yalnızca kimlik numarasıyla (uuid) anılır; onların kişisel verileri bu dosyada yer almaz.',
      'Sohbetlerde yalnızca sizin yazdığınız mesajlar vardır; karşı tarafın mesajları sayı olarak verilir.',
      'Dosyalar (profil fotoğrafı, vergi levhası vb.) adlarıyla listelenir; dosyanın kendisi için destek@influmatch.net adresine yazabilirsiniz.',
    ],
    account: {
      id: user.id,
      email: user.email ?? null,
      phone: user.phone || null,
      created_at: user.created_at,
      email_confirmed_at: user.email_confirmed_at ?? null,
      last_sign_in_at: user.last_sign_in_at ?? null,
      metadata: user.user_metadata ?? {},
    },
    profile,
    social_accounts: omit(socialRes.data as Record<string, unknown>[] | null, [
      'verification_code',
      'scrape_lock_until',
      'scrape_attempts',
      'scrape_window_started_at',
      'scrape_fail_count',
      'scrape_retry_after',
    ]),
    social_account_history: section(historyRes),
    rate_card: section(rateCardRes),
    badges: section(badgesRes),
    tax_verifications: section(taxRes),
    offers: section(offersRes),
    chat_rooms: rooms.map((room) => ({
      id: room.id,
      counterpart_user_id: room.brand_id === userId ? room.influencer_id : room.brand_id,
      created_at: (room as Record<string, unknown>).created_at,
    })),
    messages_sent: section(myMessagesRes),
    messages_received_count: receivedMessages,
    adverts: section(advertsRes),
    applications_received_count: applicationsToMyAdverts,
    applications_sent: section(applicationsRes),
    saved_adverts: section(savedAdvertsRes),
    advert_alerts: section(advertAlertsRes),
    collaborations: section(collabsRes),
    collaboration_agreements: section(agreementsRes),
    collaboration_deliverables: section(deliverablesRes),
    collaboration_submissions: section(submissionsRes),
    collaboration_payments: section(paymentsRes),
    campaigns: section(campaignsRes),
    offer_templates: section(templatesRes),
    favorites: section(favoritesRes),
    favorite_lists: section(listsRes),
    favorite_list_items: section(listItemsRes),
    discovery_spins: section(spinsRes),
    portfolio_hidden_items: section(portfolioHiddenRes),
    brand_portfolio_settings: section(brandPortfolioRes),
    notifications: section(notificationsRes),
    support_tickets: section(supportRes),
    feedback: section(feedbackRes),
    blocked_users: section(blocksRes),
    message_reports_sent: section(reportsRes),
    dismissed_offers: section(dismissedRes),
    profile_views_given: section(viewsGivenRes),
    profile_views_received_count: profileViewsReceived,
    activity: section(activityRes),
    analytics_events: section(analyticsRes),
    task_submissions: omit(tasksRes.data as Record<string, unknown>[] | null, ['reviewed_by']),
    task_rewards: section(rewardsRes),
    invite_code: section(inviteCodeRes),
    invited_users_count: invitedCount,
    consent_records: section(consentRes),
    sensitive_access_log: section(accessLogRes),
    files: { avatars: avatarFiles, tax_documents: taxFiles, task_proofs: proofFiles, advert_images: heroFiles },
  }
}
