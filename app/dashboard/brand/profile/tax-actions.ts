'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { submitTaxCertificateAs, type TaxSubmitResult } from '@/lib/brand-verification'

/**
 * Marka, vergi levhasını tax-documents/{userId}/... yoluna yükledikten sonra bu işlemi çağırır.
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
