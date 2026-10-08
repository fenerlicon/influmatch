// İlan ve başvuru işlemlerinin ortak çekirdeği (web sunucu aksiyonları ve mobil uçlar). Kullanıcının kendi
// istemcisiyle çalışır; RLS ve DB kuralları (son başvuru günü, kabul edilmiş başvurunun silinememesi vb.) aynen uygulanır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { storagePathFromPublicUrl } from '@/lib/account-deletion'
import { displayNameOf, notifyUser } from '@/lib/notify'
import { hasVerifiedSocialAccount, SOCIAL_VERIFICATION_REQUIRED } from '@/lib/creator-verification'

export type AdvertStatus = 'open' | 'paused' | 'closed'
export type ApplicationStatus = 'pending' | 'shortlisted' | 'rejected' | 'accepted'

// Çağıranlar sonucu result.error / result.success ile okuyabilsin diye iki dal da diğer alanı isteğe bağlı taşır.
// eslint-disable-next-line @typescript-eslint/ban-types
type Result<T = {}> = ({ success: true; error?: undefined } & T) | { error: string; success?: undefined }

export interface SaveAdvertInput {
  id?: string
  title: string
  summary: string
  category?: string | null
  brand_name?: string | null
  platforms?: string[]
  deliverables?: string[]
  budget_currency?: string | null
  budget_min?: number | null
  budget_max?: number | null
  location?: string | null
  hero_image: string | null
  deadline?: string | null
  status?: string
  description?: string
  payment_type?: string
  custom_questions?: unknown[]
}

/** Kapak görseli yalnızca kendi kovamızdaki bir adres olabilir (dış adres / başka kova kabul edilmez). */
export function isAllowedHeroImage(url: string | null | undefined, currentUrl?: string | null) {
  if (!url) return false
  if (currentUrl && url === currentUrl) return true
  const location = storagePathFromPublicUrl(url)
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
  return !!base && url.startsWith(`${base}/`) && location?.bucket === 'advert-hero-images' && !location.path.includes('..')
}

function cleanNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 && n <= 100_000_000 ? n : null
}

export async function saveAdvertAs(supabase: SupabaseClient, userId: string, input: SaveAdvertInput): Promise<Result<{ id: string }>> {
  const title = input.title?.trim() ?? ''
  const summary = input.summary?.trim() ?? ''
  if (!title || title.length > 150) return { error: 'İlan başlığı 1-150 karakter olmalı.' }
  if (!summary) return { error: 'İlan özeti gereklidir.' }
  if (!input.hero_image?.trim()) return { error: 'İlan kapak fotoğrafı yüklenmesi zorunludur.' }

  const { data: profile } = await supabase.from('users').select('role, verification_status').eq('id', userId).maybeSingle()
  if (profile?.role !== 'brand') return { error: 'İlanları yalnızca marka hesapları oluşturabilir.' }
  if (profile.verification_status !== 'verified') {
    return { error: 'Hesabınız henüz onaylanmadı. İlan oluşturabilmek için hesabınızın onaylanması gerekmektedir.' }
  }

  let currentHero: string | null = null
  if (input.id) {
    const { data: existing } = await supabase.from('advert_projects').select('hero_image').eq('id', input.id).eq('brand_user_id', userId).maybeSingle()
    if (!existing) return { error: 'İlan bulunamadı veya düzenleme yetkiniz yok.' }
    currentHero = existing.hero_image as string | null
  }
  if (!isAllowedHeroImage(input.hero_image, currentHero)) {
    return { error: 'Kapak fotoğrafı geçersiz. Lütfen görseli yeniden yükleyin.' }
  }

  const budgetMin = cleanNumber(input.budget_min)
  const budgetMax = cleanNumber(input.budget_max)
  if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) {
    return { error: 'En düşük bütçe en yüksek bütçeden büyük olamaz.' }
  }

  // Güncellemede yalnızca gönderilen alanlar yazılır (mobil form web'deki tüm alanları taşımıyor;
  // gönderilmeyen platform/teslimat vb. varsayılanlarla ezilmesin). Yeni ilanda varsayılanlar uygulanır.
  const has = (key: keyof SaveAdvertInput) => !input.id || key in input
  const row: Record<string, unknown> = { title, summary, hero_image: input.hero_image, brand_user_id: userId, brand_id: userId }
  if (has('category')) row.category = input.category || 'Genel'
  if (has('brand_name')) row.brand_name = input.brand_name?.trim() || null
  if (has('platforms')) row.platforms = Array.isArray(input.platforms) ? input.platforms : []
  if (has('deliverables')) row.deliverables = Array.isArray(input.deliverables) ? input.deliverables : []
  if (has('budget_currency')) row.budget_currency = input.budget_currency || 'TRY'
  if (has('budget_min')) row.budget_min = budgetMin
  if (has('budget_max')) row.budget_max = budgetMax
  if (has('location')) row.location = input.location || 'Uzaktan'
  if (has('deadline')) row.deadline = input.deadline || null

  // Açıklama gönderilmezse güncellemede mevcut açıklama ezilmez, yeni ilanda boş başlar.
  if (input.description !== undefined) row.description = input.description?.trim() || ''
  else if (!input.id) row.description = ''
  if (input.payment_type) row.payment_type = input.payment_type === 'barter' ? 'barter' : 'cash'
  // Boş dizi de yazılır: markanın tüm soruları silmesi güncellemeye yansısın.
  if (Array.isArray(input.custom_questions)) row.custom_questions = input.custom_questions
  if (input.status && ['open', 'paused', 'closed'].includes(input.status)) row.status = input.status

  if (input.id) {
    const { error } = await supabase.from('advert_projects').update(row).eq('id', input.id).eq('brand_user_id', userId)
    if (error) {
      console.error('[saveAdvert] update error', error.message)
      return { error: 'İlan güncellenemedi. Lütfen tekrar deneyin.' }
    }
    return { success: true, id: input.id }
  }

  row.status = 'open'
  const { data: created, error } = await supabase.from('advert_projects').insert(row).select('id').single()
  if (error || !created) {
    console.error('[saveAdvert] insert error', error?.message)
    return { error: 'İlan oluşturulamadı. Lütfen tekrar deneyin.' }
  }
  return { success: true, id: created.id as string }
}

export async function updateAdvertStatusAs(supabase: SupabaseClient, userId: string, advertId: string, status: AdvertStatus): Promise<Result> {
  if (!['open', 'paused', 'closed'].includes(status)) return { error: 'Geçersiz durum.' }
  const { data, error } = await supabase
    .from('advert_projects')
    .update({ status })
    .eq('id', advertId)
    .eq('brand_user_id', userId)
    .select('id')
  if (error) {
    console.error('[updateAdvertStatus] error', error.message)
    return { error: 'Durum güncellenemedi. Lütfen tekrar deneyin.' }
  }
  if (!data || data.length === 0) return { error: 'İlan bulunamadı veya yetkiniz yok.' }
  return { success: true }
}

export async function deleteAdvertAs(supabase: SupabaseClient, userId: string, advertId: string): Promise<Result> {
  const { data: advert } = await supabase
    .from('advert_projects')
    .select('id, hero_image')
    .eq('id', advertId)
    .eq('brand_user_id', userId)
    .maybeSingle()
  if (!advert) return { error: 'İlan bulunamadı veya silme yetkiniz yok.' }

  const { error } = await supabase.from('advert_projects').delete().eq('id', advertId).eq('brand_user_id', userId)
  if (error) {
    // Kabul edilmiş başvurusu olan ilanı DB silmez (check_advert_project_deletion); mesajı kullanıcıya iletilir.
    const blocked = /Kabul edilmiş başvurusu/.test(error.message)
    console.error('[deleteAdvert] error', error.message)
    return { error: blocked ? 'Kabul edilmiş başvurusu olan bir ilanı silemezsiniz; ilanı kapatabilirsiniz.' : 'İlan silinemedi. Lütfen tekrar deneyin.' }
  }

  // İlan silindikten sonra kapak görseli kaldırılır (silme başarısızsa görsel kaybolmasın).
  const stored = storagePathFromPublicUrl(advert.hero_image as string | null)
  if (stored?.bucket === 'advert-hero-images') {
    const { error: removeError } = await supabase.storage.from('advert-hero-images').remove([stored.path])
    if (removeError) console.error('[deleteAdvert] image delete error', removeError.message)
  }
  return { success: true }
}

export interface ApplyInput {
  advertId: string
  coverLetter: string
  deliverableIdea?: string | null
  budgetExpectation?: number | string | null
}

export async function applyToAdvertAs(supabase: SupabaseClient, userId: string, input: ApplyInput): Promise<Result> {
  if (!input.advertId) return { error: 'İlan bulunamadı.' }

  const { data: profile } = await supabase.from('users').select('role, verification_status').eq('id', userId).maybeSingle()
  if (profile?.role !== 'influencer') return { error: 'İlanlara yalnızca influencer hesapları başvurabilir.' }
  if (profile.verification_status !== 'verified') {
    return { error: 'Hesabınız henüz onaylanmadı. İlanlara başvurabilmek için hesabınızın onaylanması gerekmektedir.' }
  }
  if (!(await hasVerifiedSocialAccount(supabase, userId))) return { error: SOCIAL_VERIFICATION_REQUIRED }

  const coverLetter = input.coverLetter?.trim() ?? ''
  if (!coverLetter) return { error: 'Kısa bir niyet mesajı paylaşmalısınız.' }
  if (coverLetter.length > 3000) return { error: 'Niyet mesajı en fazla 3000 karakter olabilir.' }

  const { data: advert } = await supabase
    .from('advert_projects')
    .select('id, status, deadline, title, brand_user_id')
    .eq('id', input.advertId)
    .maybeSingle()
  if (!advert) return { error: 'İlan bilgisi alınamadı.' }
  if (advert.status !== 'open') return { error: 'Bu ilan artık başvuruya kapalı.' }

  // Son başvuru günü dahil (Türkiye saatiyle); DB politikası da aynı kuralı uygular.
  const todayIstanbul = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
  if (advert.deadline && (advert.deadline as string) < todayIstanbul) return { error: 'Bu ilanın son başvuru tarihi geçti.' }

  const { error } = await supabase.from('advert_applications').insert({
    advert_id: input.advertId,
    influencer_id: userId,
    influencer_user_id: userId,
    cover_letter: coverLetter,
    deliverable_idea: input.deliverableIdea?.toString().trim() || null,
    budget_expectation: cleanNumber(input.budgetExpectation),
  })
  if (error) {
    if (error.code === '23505') return { error: 'Bu ilana zaten başvurdunuz.' }
    console.error('[applyToAdvert] insert error', error.message)
    return { error: 'Başvuru kaydedilemedi. Lütfen tekrar deneyin.' }
  }

  if (advert.brand_user_id) {
    const admin = createSupabaseAdminClient()
    const influencerName = await displayNameOf(admin, userId)
    await notifyUser(
      {
        userId: advert.brand_user_id as string,
        event: 'application_new',
        title: 'İlanınıza yeni başvuru',
        message: `${influencerName}, "${advert.title ?? 'ilanınıza'}" ilanına başvurdu.`,
        link: '/dashboard/brand/advert?tab=applications',
      },
      admin,
    )
  }
  return { success: true }
}

export async function cancelApplicationAs(supabase: SupabaseClient, userId: string, applicationId: string): Promise<Result> {
  if (!applicationId) return { error: 'Başvuru bulunamadı.' }
  const { data: application } = await supabase
    .from('advert_applications')
    .select('id, status, influencer_id, influencer_user_id')
    .eq('id', applicationId)
    .maybeSingle()
  if (!application) return { error: 'Başvuru bulunamadı.' }
  if (application.influencer_id !== userId && application.influencer_user_id !== userId) {
    return { error: 'Bu başvuruyu iptal etme yetkiniz yok.' }
  }

  // Yalnızca bekleyen başvuru geri çekilebilir; DB kuralı da kabul edilmiş / ön listedeki başvuruyu silmez.
  if (application.status !== 'pending') {
    return {
      error:
        application.status === 'accepted'
          ? 'Kabul edilen bir başvuruyu geri çekemezsiniz.'
          : application.status === 'shortlisted'
            ? 'Ön listeye alınan bir başvuruyu geri çekemezsiniz. Marka ile mesajlaşarak iletebilirsiniz.'
            : 'Bu başvuru geri çekilemez.',
    }
  }

  const { data: deleted, error } = await supabase.from('advert_applications').delete().eq('id', applicationId).select('id')
  if (error || !deleted || deleted.length === 0) {
    if (error) console.error('[cancelApplication] delete error', error)
    return { error: 'Başvuru geri çekilemedi. Lütfen tekrar deneyin.' }
  }
  return { success: true }
}

export async function updateApplicationStatusAs(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
  status: ApplicationStatus,
): Promise<Result> {
  if (!['pending', 'shortlisted', 'rejected', 'accepted'].includes(status)) return { error: 'Geçersiz durum.' }

  const { data: application } = await supabase
    .from('advert_applications')
    .select('id, advert_id, status, influencer_id, influencer_user_id')
    .eq('id', applicationId)
    .maybeSingle()
  if (!application) return { error: 'Başvuru bulunamadı.' }

  const { data: advert } = await supabase.from('advert_projects').select('id, brand_user_id, title').eq('id', application.advert_id).maybeSingle()
  if (!advert) return { error: 'İlan bulunamadı.' }
  if (advert.brand_user_id !== userId) return { error: 'Bu başvuruyu güncelleme yetkiniz yok.' }

  const { data: updated, error } = await supabase.from('advert_applications').update({ status }).eq('id', applicationId).select('id')
  if (error) {
    console.error('[updateApplicationStatus] update error:', error)
    return { error: 'Durum güncellenemedi. Lütfen tekrar deneyin.' }
  }
  if (!updated || updated.length === 0) return { error: 'Bu başvuruyu güncelleme yetkiniz yok.' }

  // Başvuru sonucu influencer'a bildirilir (geri alma, yani tekrar beklemeye çekme bildirilmez).
  const influencerId = (application.influencer_user_id ?? application.influencer_id) as string | null
  if (status !== 'pending' && status !== application.status && influencerId) {
    const advertTitle = advert.title ? `"${advert.title}"` : 'ilan'
    const copy = {
      shortlisted: { title: 'Başvurunuz ön listeye alındı', message: `${advertTitle} başvurunuz ön listeye alındı.`, type: 'success' as const },
      accepted: { title: 'Başvurunuz kabul edildi', message: `${advertTitle} başvurunuz kabul edildi. Marka sizinle iletişime geçecek.`, type: 'success' as const },
      rejected: { title: 'Başvurunuz sonuçlandı', message: `${advertTitle} başvurunuz bu kez olumlu sonuçlanmadı.`, type: 'info' as const },
    }[status]
    await notifyUser({ userId: influencerId, event: 'application_status', link: '/dashboard/influencer/advert', ...copy })
  }
  return { success: true }
}

/** Başvuruya ait sohbet odasını açar veya mevcut olanı döner (marka ya da başvuran). */
export async function openApplicationRoomAs(supabase: SupabaseClient, userId: string, applicationId: string): Promise<Result<{ roomId: string }>> {
  const { data: application } = await supabase
    .from('advert_applications')
    .select('id, advert_id, influencer_id, influencer_user_id')
    .eq('id', applicationId)
    .maybeSingle()
  if (!application) return { error: 'Başvuru bulunamadı.' }

  const { data: advert } = await supabase.from('advert_projects').select('id, brand_user_id').eq('id', application.advert_id).maybeSingle()
  if (!advert) return { error: 'İlan bulunamadı.' }

  const influencerId = (application.influencer_id || application.influencer_user_id) as string
  const brandId = advert.brand_user_id as string
  if (userId !== brandId && userId !== influencerId) return { error: 'Bu başvuruya erişim yetkiniz yok.' }

  // Yalnızca bu başvuruya ait oda yeniden kullanılır.
  const { data: existing } = await supabase.from('rooms').select('id').eq('advert_application_id', applicationId).limit(1).maybeSingle()
  if (existing?.id) return { success: true, roomId: existing.id as string }

  const { data: room, error } = await supabase
    .from('rooms')
    .insert({ brand_id: brandId, influencer_id: influencerId, advert_application_id: applicationId })
    .select('id')
    .single()
  if (error || !room) {
    console.error('[openApplicationRoom] insert error', error?.message)
    return { error: 'Sohbet açılamadı. Lütfen tekrar deneyin.' }
  }
  // Başvuru durumu burada değiştirilmez.
  return { success: true, roomId: room.id as string }
}
