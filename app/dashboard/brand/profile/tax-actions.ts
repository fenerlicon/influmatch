'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { validateTaxNumber } from '@/lib/tax-id'
import { MAX_SUBMISSIONS_PER_DAY, processTaxCertificate } from '@/lib/tax-verification'

type SubmitResult =
  | { success: true; status: 'auto_approved' | 'needs_review' | 'rejected'; reasons: string[] }
  | { success: false; error: string }

/**
 * Marka, vergi levhasını tax-documents/{userId}/... yoluna yükledikten sonra bu işlemi çağırır.
 */
export async function submitTaxCertificate(filePath: string): Promise<SubmitResult> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum açmanız gerekiyor.' }

  // Dosya sadece kullanıcının kendi klasöründe olabilir (depolama politikası da bunu zorlar).
  const parts = filePath.split('/')
  if (parts.length !== 2 || parts[0] !== user.id || !parts[1] || parts[1].startsWith('.')) {
    return { success: false, error: 'Geçersiz dosya.' }
  }

  const admin = createSupabaseAdminClient()
  if (!admin) return { success: false, error: 'Sistem yapılandırma hatası.' }

  const { data: profile } = await admin
    .from('users')
    .select('role, tax_id, tax_office, tax_office_city, tax_id_verified')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'brand') return { success: false, error: 'Bu işlem sadece markalar içindir.' }
  if (profile.tax_id_verified) return { success: false, error: 'Vergi numaranız zaten doğrulanmış.' }
  if (!profile.tax_id || !validateTaxNumber(profile.tax_id).isValid || !profile.tax_office || !profile.tax_office_city) {
    return { success: false, error: 'Önce Kurumsal Kimlik bölümünde vergi numarası, vergi dairesi ve ili kaydedin.' }
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('tax_verifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since)
  if ((count ?? 0) >= MAX_SUBMISSIONS_PER_DAY) {
    return { success: false, error: `Günde en fazla ${MAX_SUBMISSIONS_PER_DAY} belge yükleyebilirsiniz. Lütfen yarın tekrar deneyin.` }
  }

  try {
    const outcome = await processTaxCertificate(admin, user.id, filePath)
    revalidatePath('/dashboard/brand/profile')
    revalidatePath('/dashboard/brand')
    revalidatePath('/admin')
    return { success: true, status: outcome.status, reasons: outcome.reasons }
  } catch (error) {
    console.error('[submitTaxCertificate]', error)
    return { success: false, error: error instanceof Error ? error.message : 'Belge işlenemedi.' }
  }
}
