'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { TAX_DOCUMENTS_BUCKET } from '@/lib/tax-verification'
import { logPrivacyAccess } from '@/lib/privacy-audit'

// Vergi levhası belgesini admin için 10 dakikalık imzalı bağlantıyla açar ve açılışı hassas erişim günlüğüne yazar
// (KVKK veri güvenliği tedbiri; SYSTEM_MAP 14). app/admin/actions.ts içindeki eski günlüksüz sürümün yerine bu kullanılır.
export async function getTaxDocumentUrl(verificationId: string): Promise<{ url?: string; error?: string }> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' }

  const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (adminProfile?.role !== 'admin') return { error: 'Bu işlem için yetkiniz yok.' }

  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sistem yapılandırma hatası.' }

  const { data: verification } = await admin
    .from('tax_verifications')
    .select('user_id, file_path')
    .eq('id', verificationId)
    .maybeSingle()
  if (!verification?.file_path) return { error: 'Belge bulunamadı.' }

  const { data, error } = await admin.storage.from(TAX_DOCUMENTS_BUCKET).createSignedUrl(verification.file_path as string, 600)
  if (error || !data) return { error: 'Belge bağlantısı oluşturulamadı.' }

  await logPrivacyAccess(admin, {
    actorId: user.id,
    action: 'tax_document_view',
    subjectUserId: (verification.user_id as string | null) ?? null,
    resourceId: verificationId,
  })
  return { url: data.signedUrl }
}
