'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { createTaxUploadUrlAs, submitTaxCertificateAs, type TaxSubmitResult, type TaxUploadUrlResult } from '@/lib/brand-verification'

/**
 * Vergi levhası için imzalı yükleme adresi ister (günlük sınır ve ön koşullar burada kontrol edilir).
 * İstemci kovaya doğrudan yükleyemez; yalnızca bu adresle yükler (3.10-S1).
 */
export async function requestTaxUploadUrl(extension: string): Promise<TaxUploadUrlResult> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum açmanız gerekiyor.' }

  const admin = createSupabaseAdminClient()
  if (!admin) return { success: false, error: 'Sistem yapılandırma hatası.' }

  return createTaxUploadUrlAs(admin, user.id, extension)
}

/**
 * Marka, vergi levhasını imzalı adresle tax-documents/{userId}/... yoluna yükledikten sonra bu işlemi çağırır.
 * Kurallar lib/brand-verification.ts içinde (mobil ile ortak).
 */
export async function submitTaxCertificate(filePath: string): Promise<TaxSubmitResult> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum açmanız gerekiyor.' }

  const admin = createSupabaseAdminClient()
  if (!admin) return { success: false, error: 'Sistem yapılandırma hatası.' }

  const result = await submitTaxCertificateAs(admin, user.id, filePath)
  if (result.success) {
    revalidatePath('/dashboard/brand/profile')
    revalidatePath('/dashboard/brand')
    revalidatePath('/admin')
  }
  return result
}
