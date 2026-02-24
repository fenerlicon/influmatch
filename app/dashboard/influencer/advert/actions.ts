'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'

interface ApplyToAdvertPayload {
  advertId: string
  coverLetter: string
  deliverableIdea?: string
  budgetExpectation?: number | null
}

export async function applyToAdvert(payload: ApplyToAdvertPayload) {
  const { advertId, coverLetter, deliverableIdea, budgetExpectation } = payload
  if (!advertId) {
    return { error: 'İlan bulunamadı.' }
  }

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Oturum açmanız gerekiyor.' }
  }

  // Check verification status
  const { data: userProfile } = await supabase
    .from('users')
    .select('verification_status')
    .eq('id', user.id)
    .maybeSingle()

  if (userProfile?.verification_status !== 'verified') {
    return { error: 'Hesabınız henüz onaylanmadı. İlanlara başvurabilmek için hesabınızın onaylanması gerekmektedir.' }
  }

  const trimmedCoverLetter = coverLetter?.trim()
  if (!trimmedCoverLetter) {
    return { error: 'Kısa bir niyet mesajı paylaşmalısınız.' }
  }

  const { data: advert, error: advertError } = await supabase.from('advert_projects').select('id, status').eq('id', advertId).maybeSingle()

  if (advertError || !advert) {
    return { error: 'İlan bilgisi alınamadı.' }
  }

  if (advert.status !== 'open') {
    return { error: 'Bu ilan artık başvuruya kapalı.' }
  }

  const { error: insertError } = await supabase.from('advert_applications').insert({
    advert_id: advertId,
    influencer_id: user.id, // Database column name
    influencer_user_id: user.id, // Also set this if both columns exist
    cover_letter: trimmedCoverLetter,
    deliverable_idea: deliverableIdea?.trim() || null,
    budget_expectation: typeof budgetExpectation === 'number' && !Number.isNaN(budgetExpectation) ? budgetExpectation : null,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      return { error: 'Bu ilana zaten başvurdunuz.' }
    }
    console.error('[applyToAdvert] insert error', {
      message: insertError.message,
      code: insertError.code,
      details: insertError.details,
      hint: insertError.hint,
    })
    return { error: `Başvuru kaydedilemedi: ${insertError.message || 'Lütfen tekrar deneyin.'}` }
  }

  revalidatePath('/dashboard/influencer/advert')
  return { success: true }
}

export async function cancelApplication(applicationId: string) {
  if (!applicationId) return { error: 'Başvuru bulunamadı.' }

  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Oturum açmanız gerekiyor.' }

  // Fetch the application — ensure it belongs to this user
  const { data: application, error: fetchError } = await supabase
    .from('advert_applications')
    .select('id, status, influencer_id')
    .eq('id', applicationId)
    .maybeSingle()

  if (fetchError || !application) return { error: 'Başvuru bulunamadı.' }

  // Ownership check
  if (application.influencer_id !== user.id) {
    return { error: 'Bu başvuruyu iptal etme yetkiniz yok.' }
  }

  // Only pending or shortlisted can be cancelled
  if (!['pending', 'shortlisted'].includes(application.status)) {
    return {
      error: application.status === 'accepted'
        ? 'Kabul edilen bir başvuruyu geri çekemezsiniz.'
        : 'Bu başvuru zaten iptal edilmiş.',
    }
  }

  const { error: deleteError } = await supabase
    .from('advert_applications')
    .delete()
    .eq('id', applicationId)

  if (deleteError) {
    console.error('[cancelApplication] delete error', deleteError)
    return { error: 'Başvuru iptal edilemedi: ' + deleteError.message }
  }

  revalidatePath('/dashboard/influencer/advert')
  return { success: true }
}

