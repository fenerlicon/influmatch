// "İlk adımlar" kontrol listesi (sunucu tarafı). Web panelleri çerez istemcisiyle, mobil
// /api/mobile/first-steps ucu kullanıcının JWT'li istemcisiyle aynı fonksiyonu çağırır.
// Durum her istekte hesaplanır; ayrı tablo yok. Sorgular yalnızca sayım / tek satırdır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateProfileCompletion, type ProfileRecord } from '@/utils/profileCompletion'
import { hasVerifiedSocialAccount } from '@/lib/creator-verification'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { firstStepsLabel, type FirstStep, type FirstStepsStatus } from '@/lib/first-steps-shared'

export type { FirstStep, FirstStepsStatus } from '@/lib/first-steps-shared'

const PENDING_TAX_STATUSES = ['processing', 'needs_review']

/** Sorgu hatasında adım "yapılmadı" sayılır (yalnızca yönlendirme kartı; yetki kararı değil). */
async function hasAnyRow(query: PromiseLike<{ count: number | null; error: unknown }>): Promise<boolean> {
  const { count, error } = await query
  return !error && (count ?? 0) > 0
}

function summarize(role: FirstStepsStatus['role'], steps: FirstStep[]): FirstStepsStatus {
  const completed = steps.filter((s) => s.done).length
  return {
    role,
    steps,
    completed,
    total: steps.length,
    allDone: completed === steps.length,
    label: firstStepsLabel(completed, steps.length),
  }
}

async function influencerSteps(supabase: SupabaseClient, userId: string, profile: ProfileRecord): Promise<FirstStepsStatus> {
  const [verified, rateCard, applied] = await Promise.all([
    hasVerifiedSocialAccount(supabase, userId),
    supabase
      .from('rate_cards')
      .select('story_price, reel_price, post_price, ugc_video_price, package_price')
      .eq('user_id', userId)
      .maybeSingle(),
    hasAnyRow(
      supabase
        .from('advert_applications')
        .select('id', { count: 'exact', head: true })
        .or(`influencer_user_id.eq.${userId},influencer_id.eq.${userId}`),
    ),
  ])

  const card = rateCard.data as Record<string, number | null> | null
  const hasPrice = !!card && Object.values(card).some((v) => typeof v === 'number' && v > 0)
  // Panelde "Profil Doluluk" kartıyla aynı eşik: %100.
  const profileComplete = calculateProfileCompletion(profile).percent >= 100

  return summarize('influencer', [
    {
      key: 'verify_social',
      title: 'Hesabını doğrula',
      description: 'Instagram veya TikTok hesabını doğrula.',
      done: verified,
      note: null,
      href: '/dashboard/influencer#verification-section',
    },
    {
      key: 'complete_profile',
      title: 'Profilini tamamla',
      description: 'Fotoğraf, ad, kullanıcı adı, şehir, kategori, biyografi ve sosyal bağlantılar.',
      done: profileComplete,
      note: null,
      href: '/dashboard/influencer/profile',
    },
    {
      key: 'rate_card',
      title: 'Fiyat kartını gir',
      description: 'En az bir teslimat türü için başlangıç fiyatı ekle.',
      done: hasPrice,
      note: null,
      href: '/dashboard/influencer/profile',
    },
    {
      key: 'first_application',
      title: 'İlk ilana başvur',
      description: 'Açık ilanlara göz at ve birine başvur.',
      done: applied,
      note: null,
      href: '/dashboard/influencer/advert',
    },
  ])
}

async function brandSteps(supabase: SupabaseClient, userId: string): Promise<FirstStepsStatus> {
  // corporate_email_verified_at istemci rollerine kapalı bir kolon; yalnızca sahibinin kendi durumu için sunucuda okunur.
  const admin = createSupabaseAdminClient()
  const [corporate, latestTax, advert, offer] = await Promise.all([
    admin
      ? admin.from('users').select('corporate_email_verified_at').eq('id', userId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('tax_verifications')
      .select('status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    hasAnyRow(supabase.from('advert_projects').select('id', { count: 'exact', head: true }).eq('brand_user_id', userId)),
    hasAnyRow(supabase.from('offers').select('id', { count: 'exact', head: true }).eq('sender_user_id', userId)),
  ])

  const corporateVerified = !!(corporate.data as { corporate_email_verified_at: string | null } | null)?.corporate_email_verified_at
  const taxStatus = (latestTax.data as { status: string } | null)?.status ?? null
  // Reddedilen levha yeniden yüklenmeli; bu yüzden yalnızca reddedilmemiş son kayıt adımı tamamlar.
  const taxDone = !!taxStatus && taxStatus !== 'rejected'
  const taxNote = taxStatus && PENDING_TAX_STATUSES.includes(taxStatus) ? 'İnceleniyor' : taxStatus === 'rejected' ? 'Reddedildi' : null

  return summarize('brand', [
    {
      key: 'corporate_email',
      title: 'Kurumsal e-postanı doğrula',
      description: 'Şirket alan adındaki e-postana gelen kodu gir.',
      done: corporateVerified,
      note: null,
      href: '/dashboard/brand/profile',
    },
    {
      key: 'tax_certificate',
      title: 'Vergi levhanı yükle',
      description: 'Kurumsal kimlik bölümünden vergi levhanı yükle.',
      done: taxDone,
      note: taxNote,
      href: '/dashboard/brand/profile',
    },
    {
      key: 'first_advert',
      title: 'İlk ilanını aç',
      description: 'Kampanyan için bir ilan oluştur.',
      done: advert,
      note: null,
      href: '/dashboard/brand/advert?tab=mine',
    },
    {
      key: 'first_offer',
      title: 'İlk teklifini gönder',
      description: 'Keşfette bir profil seç ve teklif gönder.',
      done: offer,
      note: null,
      href: '/dashboard/brand/discover',
    },
  ])
}

/** Kullanıcının rolüne göre ilk adımlar durumu. Influencer/UGC ve marka dışındaki roller için null. */
export async function getFirstStepsStatus(supabase: SupabaseClient, userId: string): Promise<FirstStepsStatus | null> {
  const { data: user } = await supabase
    .from('users')
    .select('role, full_name, username, city, bio, category, avatar_url, social_links')
    .eq('id', userId)
    .maybeSingle()
  if (!user) return null

  if (user.role === 'brand') return brandSteps(supabase, userId)
  if (user.role === 'influencer') {
    return influencerSteps(supabase, userId, {
      full_name: user.full_name ?? null,
      username: user.username ?? null,
      city: user.city ?? null,
      bio: user.bio ?? null,
      category: user.category ?? null,
      avatar_url: user.avatar_url ?? null,
      social_links: (user.social_links as Record<string, string | null> | null) ?? null,
    })
  }
  return null
}
