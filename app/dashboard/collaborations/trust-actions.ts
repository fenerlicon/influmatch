'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { acceptCommitment } from '@/lib/collaboration-trust'
import { createClaimProofUploadUrlAs, createProofUploadUrlAs, proofUrlFor } from '@/lib/collaboration-disputes'
import { logPrivacyAccess } from '@/lib/privacy-audit'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'

// Güvenli iş birliği (2026-11-23) web aksiyonları. Yetki ortak kodda (lib/collaboration-trust.ts, lib/collaboration-disputes.ts).

async function currentUserId() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

/** Marka taahhüdünü kabul eder (ilk ilan / ilk teklif öncesi pencere). */
export async function acceptCommitmentAction(input: { version?: unknown; accepted?: unknown }): Promise<{ success: true; error?: undefined } | { success?: undefined; error: string }> {
  const userId = await currentUserId()
  if (!userId) return { error: 'Oturumunuz bulunamadı.' }
  const result = await acceptCommitment(userId, input ?? {}, 'web')
  if (!result.success) return { error: result.error }
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}

/** Anlaşmazlık kanıtı için imzalı yükleme adresi (yalnızca karşı taraf). */
export async function disputeProofUploadAction(
  collaborationId: string,
  disputeId: string,
  extension: string,
): Promise<{ success: true; error?: undefined; path: string; token: string; bucket: string } | { success?: undefined; error: string }> {
  const userId = await currentUserId()
  if (!userId) return { error: 'Oturumunuz bulunamadı.' }
  return createProofUploadUrlAs(userId, typeof collaborationId === 'string' ? collaborationId : '', disputeId, extension)
}

/** Kanıt dosyasını 10 dakikalık bağlantıyla açar (yalnızca anlaşmazlığın tarafları). */
export async function disputeProofUrlAction(disputeId: string): Promise<{ success: true; error?: undefined; url: string } | { success?: undefined; error: string }> {
  const userId = await currentUserId()
  if (!userId) return { error: 'Oturumunuz bulunamadı.' }
  const result = await proofUrlFor(userId, disputeId)
  if (result.success) await logPrivacyAccess(createSupabaseAdminClient(), { actorId: userId, action: 'payment_proof_view', resourceId: String(disputeId) })
  return result
}

/** Marka "Ödemeyi yaptım ama onaylanmadı" başvurusunun dekontu için imzalı yükleme adresi (2026-11-24). */
export async function claimProofUploadAction(
  collaborationId: string,
  extension: string,
): Promise<{ success: true; error?: undefined; path: string; token: string; bucket: string } | { success?: undefined; error: string }> {
  const userId = await currentUserId()
  if (!userId) return { error: 'Oturumunuz bulunamadı.' }
  return createClaimProofUploadUrlAs(userId, typeof collaborationId === 'string' ? collaborationId : '', extension)
}
