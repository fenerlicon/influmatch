// Kullanıcı bildirimleri (kullanıcı kararı, 2026-10-09):
// - Her olay site içi bildirim (notifications tablosu, zil) olarak yazılır.
// - Önemli olaylarda e-posta da gider: yeni teklif, teklif yanıtı, başvuru sonucu, destek yanıtı,
//   iş birliği yayın linki / tamamlanma / iptal, süresi dolan teklif (markaya), ilan alarmı (influencer'a).
//   Yeni mesaj e-postası alıcı başına en fazla saatte bir; alıcı o an çevrimiçiyse gönderilmez.
// - Kullanıcının ayarlardaki e-posta tercihleri (users.email_notifications) uygulanır.
// - Mobil uygulaması olan kullanıcıya push da gider (lib/push.ts); push metni e-postadaki sade metindir
//   (mesaj içeriği gönderilmez). Push'u kullanıcı telefonun bildirim ayarlarından kapatır.
// - Resend kotası %80'i geçince bildirim e-postaları durur; doğrulama kodu / şifre e-postaları etkilenmez
//   (onlar bu modülden geçmez). Site içi bildirim her durumda yazılır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır. Çağıran taraf olayın
// gerçekten gerçekleştiğini (yetki, sahiplik) kendisi doğrular.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { getSystemState } from '@/lib/api-keys'
import { sendEmail } from '@/lib/email'
import { resendLimits, rolloverUsage, RESEND_USAGE_STATE_KEY, type ResendUsage } from '@/lib/resend-status'
import { isOnline } from '@/lib/presence'
import { sendPushToUser } from '@/lib/push'

export type NotificationEvent =
  | 'offer_new'
  | 'offer_response'
  | 'offer_talk'
  | 'application_new'
  | 'application_status'
  | 'message_new'
  | 'support_reply'
  | 'badge_change'
  | 'collab_new'
  | 'collab_published'
  | 'collab_completed'
  | 'collab_cancelled'
  | 'offer_expired'
  | 'advert_alert'

type EmailPreferenceKey = 'offers' | 'advert_applications' | 'messages' | 'updates'

const EVENT_CONFIG: Record<NotificationEvent, { preference: EmailPreferenceKey; email: boolean }> = {
  offer_new: { preference: 'offers', email: true },
  offer_response: { preference: 'offers', email: true },
  offer_talk: { preference: 'offers', email: false },
  application_new: { preference: 'advert_applications', email: false },
  application_status: { preference: 'advert_applications', email: true },
  message_new: { preference: 'messages', email: true },
  support_reply: { preference: 'updates', email: true },
  badge_change: { preference: 'updates', email: false },
  // İş birliği olayları teklif tercihine bağlı. Açılış e-postası yok: aynı anda teklif yanıtı / başvuru sonucu e-postası gidiyor.
  collab_new: { preference: 'offers', email: false },
  collab_published: { preference: 'offers', email: true },
  collab_completed: { preference: 'offers', email: true },
  collab_cancelled: { preference: 'offers', email: true },
  // Yanıtlanmadan süresi dolan teklif markaya bildirilir.
  offer_expired: { preference: 'offers', email: true },
  // İlan alarmı: influencer'ın kurduğu alarma uyan yeni ilan ("İlan Başvuruları" e-posta tercihi).
  advert_alert: { preference: 'advert_applications', email: true },
}

const NOTIFICATION_EMAIL_MAX_RATIO = 0.8
const MESSAGE_THROTTLE_MS = 60 * 60 * 1000

export interface NotifyInput {
  userId: string
  event: NotificationEvent
  title: string
  message: string
  /** Site içi yol (ör. /dashboard/offers). */
  link?: string | null
  type?: 'info' | 'success' | 'warning' | 'system'
  /** E-postada title/message yerine kullanılacak metin (ör. mesaj içeriği e-postaya konmaz). */
  email?: { subject: string; text: string }
}

function siteUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://influmatch.net').replace(/\/+$/, '')
  return `${base}${path}`
}

/** Bildirim e-postaları için kota uygun mu (%80 altında). Kayıt yoksa uygun sayılır. */
async function notificationEmailAllowed(admin: SupabaseClient) {
  const usage = rolloverUsage(await getSystemState<ResendUsage>(admin, RESEND_USAGE_STATE_KEY))
  if (usage.quota_exceeded) return false
  const limits = resendLimits()
  return usage.daily_used < limits.daily * NOTIFICATION_EMAIL_MAX_RATIO && usage.monthly_used < limits.monthly * NOTIFICATION_EMAIL_MAX_RATIO
}

async function maybeSendEmail(admin: SupabaseClient, input: NotifyInput) {
  const config = EVENT_CONFIG[input.event]
  if (!config.email) return

  const [{ data: user }, { data: activity }] = await Promise.all([
    admin.from('users').select('email, email_notifications').eq('id', input.userId).maybeSingle(),
    admin.from('user_activity').select('last_seen_at').eq('user_id', input.userId).maybeSingle(),
  ])
  if (!user?.email) return

  const prefs = (user.email_notifications as Partial<Record<EmailPreferenceKey, boolean>> | null) ?? {}
  if (prefs[config.preference] === false) return

  // Sohbet açıkken mesaj e-postası gereksiz.
  if (input.event === 'message_new' && isOnline(activity?.last_seen_at as string | null | undefined)) return

  if (!(await notificationEmailAllowed(admin))) return

  const linkLine = input.link ? `\n\nGörüntülemek için: ${siteUrl(input.link)}` : ''
  const footer = '\n\n—\nBu e-postayı almak istemiyorsanız panelde Ayarlar > E-posta bildirimleri bölümünden kapatabilirsiniz.'
  const result = await sendEmail({
    to: [user.email as string],
    subject: `Influmatch: ${input.email?.subject ?? input.title}`,
    text: `${input.email?.text ?? input.message}${linkLine}${footer}`,
  })
  if (!result.sent && result.code !== 'not_configured') {
    console.error(`[notify] ${input.event} e-postası gönderilemedi:`, result.reason)
  }
}

/** Site içi bildirim yazar, uygunsa e-posta gönderir. Hata fırlatmaz; asıl işlemi bozmaz. */
export async function notifyUser(input: NotifyInput, admin: SupabaseClient | null = createSupabaseAdminClient()) {
  if (!admin || !input.userId) return
  try {
    // Mesajlarda alıcı başına saatte bir bildirim (zil + e-posta); arada gelenler aynı bildirimin altında kalır.
    if (input.event === 'message_new' && input.link) {
      const since = new Date(Date.now() - MESSAGE_THROTTLE_MS).toISOString()
      const { data: recent } = await admin
        .from('notifications')
        .select('id')
        .eq('user_id', input.userId)
        .eq('link', input.link)
        .gte('created_at', since)
        .limit(1)
      if (recent && recent.length > 0) return
    }

    const { error } = await admin.from('notifications').insert({
      user_id: input.userId,
      title: input.title.slice(0, 120),
      message: input.message.slice(0, 1000),
      type: input.type ?? 'info',
      link: input.link ?? null,
    })
    if (error) console.error(`[notify] ${input.event} bildirimi yazılamadı:`, error.message)

    await Promise.all([
      maybeSendEmail(admin, input),
      sendPushToUser(admin, input.userId, {
        title: input.email?.subject ?? input.title,
        body: input.email?.text ?? input.message,
        link: input.link ?? null,
      }),
    ])
  } catch (error) {
    console.error(`[notify] ${input.event} işlenemedi:`, error)
  }
}

/** Kısa ad: bildirim metinlerinde kullanıcı adı yerine görünen ad. */
export async function displayNameOf(admin: SupabaseClient | null, userId: string): Promise<string> {
  if (!admin) return 'Bir kullanıcı'
  const { data } = await admin.from('users').select('full_name, username').eq('id', userId).maybeSingle()
  return (data?.full_name as string | null) || (data?.username ? `@${data.username}` : null) || 'Bir kullanıcı'
}
