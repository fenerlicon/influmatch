'use server'

import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { getViewer } from '@/lib/viewer-role'
import { loadLastSeen } from '@/lib/presence'

/** Admin paneli çevrimiçi göstergelerini dakikada bir bununla tazeler. */
export async function getLastSeenMap(): Promise<{ lastSeen?: Record<string, string>; error?: string }> {
  const viewer = await getViewer()
  if (!viewer || viewer.role !== 'admin') return { error: 'Bu işlem için yetkiniz yok.' }

  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sistem yapılandırma hatası.' }

  return { lastSeen: await loadLastSeen(admin) }
}
