// Hassas erişim günlüğü (KVKK veri güvenliği tedbiri; SYSTEM_MAP 14). BU DOSYA 'use server' DEĞİLDİR.
// Admin'in vergi levhası / özel ek açması ve kullanıcının kendi verisini indirmesi `privacy_audit_log`'a yazılır.
// Tablo istemcilere kapalı, yazım service role. Tablo yoksa (SQL çalıştırılmadıysa) kayıt atlanır, işlem sürer.

import type { SupabaseClient } from '@supabase/supabase-js'
import { isMissingTableError } from '@/lib/consent'

export type PrivacyAuditAction = 'tax_document_view' | 'attachment_view' | 'task_proof_view' | 'data_export'

export async function logPrivacyAccess(
  admin: SupabaseClient | null,
  input: { actorId: string; action: PrivacyAuditAction; subjectUserId?: string | null; resourceId?: string | null },
): Promise<void> {
  if (!admin) return
  try {
    const { error } = await admin.from('privacy_audit_log').insert({
      actor_id: input.actorId,
      subject_user_id: input.subjectUserId ?? null,
      action: input.action,
      resource_id: input.resourceId ? input.resourceId.slice(0, 300) : null,
    })
    if (error && !isMissingTableError(error)) console.error('[privacy-audit] yazılamadı:', error.message)
  } catch (error) {
    console.error('[privacy-audit] hata:', error)
  }
}

/**
 * Kullanıcının bu işlemi en son ne zaman yaptığı (hız sınırı için). Tablo yoksa `undefined`
 * (çağıran bellek içi sınıra düşer); kayıt yoksa `null`.
 */
export async function lastPrivacyActionAt(
  admin: SupabaseClient,
  actorId: string,
  action: PrivacyAuditAction,
): Promise<Date | null | undefined> {
  const { data, error } = await admin
    .from('privacy_audit_log')
    .select('created_at')
    .eq('actor_id', actorId)
    .eq('action', action)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return undefined
  return data?.created_at ? new Date(data.created_at as string) : null
}
