// Rıza kayıtları (KVKK; SYSTEM_MAP 14, docs/KVKK.md). BU DOSYA 'use server' DEĞİLDİR; yalnızca sunucuda.
// Tablo `consent_records` istemcilere kapalıdır, yazım service role ile. Tablo henüz yoksa (elle çalıştırılacak SQL
// `supabase/manual/2026-10-26_kvkk.sql`) kayıt sessizce atlanır; asıl işlem (ayar kaydı vb.) asla bozulmaz.
// Kayıt onayı (terms_privacy) burada değil, kayıt anında veritabanı tetikleyicisiyle yazılır (sunucu saati).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConsentKind } from '@/lib/consent-shared'

export type ConsentSource = 'web' | 'mobile'

/** Tablo yok / şema önbelleğinde yok hataları: SQL henüz çalıştırılmadı. */
export function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table/i.test(error.message ?? '')
}

export async function recordConsent(
  admin: SupabaseClient | null,
  input: { userId: string; kind: ConsentKind; granted: boolean; version?: string | null; source: ConsentSource },
): Promise<void> {
  if (!admin || !input.userId) return
  try {
    const { error } = await admin.from('consent_records').insert({
      user_id: input.userId,
      kind: input.kind,
      granted: input.granted,
      version: input.version ? input.version.slice(0, 40) : null,
      source: input.source,
    })
    if (error && !isMissingTableError(error)) console.error('[consent] kaydedilemedi:', error.message)
  } catch (error) {
    console.error('[consent] kayıt hatası:', error)
  }
}

/** Kullanıcının bir rıza türündeki son kaydı (yoksa null). */
export async function latestConsent(admin: SupabaseClient, userId: string, kind: ConsentKind) {
  const { data, error } = await admin
    .from('consent_records')
    .select('granted, version, created_at')
    .eq('user_id', userId)
    .eq('kind', kind)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return data as { granted: boolean; version: string | null; created_at: string } | null
}
