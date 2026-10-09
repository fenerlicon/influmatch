'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { loadPlatformSettings, savePlatformSettings } from '@/lib/platform-settings'
import { validatePlatformSettingsInput, type PlatformSettings } from '@/lib/platform-settings-shared'

type Result = { success: true; settings: PlatformSettings } | { success: false; error: string }

// Ücretsiz marka sınırları ve keşif çarkı ayarları. Rol DB'den kontrol edilir; tablo yalnızca service role ile yazılır.
export async function updatePlatformSettings(input: Record<string, unknown>): Promise<Result> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum açmanız gerekiyor.' }
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return { success: false, error: 'Bu işlem için yetkiniz yok.' }

  const admin = createSupabaseAdminClient()
  if (!admin) return { success: false, error: 'Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.' }

  const parsed = validatePlatformSettingsInput(input && typeof input === 'object' ? input : {})
  if ('error' in parsed) return { success: false, error: parsed.error }

  try {
    await savePlatformSettings(admin, user.id, parsed)
  } catch (error) {
    console.error('[admin/limits] save error:', error)
    return { success: false, error: 'Ayarlar kaydedilemedi.' }
  }
  revalidatePath('/admin/limits')
  return { success: true, settings: await loadPlatformSettings(admin) }
}
