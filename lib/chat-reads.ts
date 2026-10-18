// "Görüldü" (lib/chat-live-shared.ts): karşı tarafın sohbetteki son okuma zamanı. room_reads satırları yalnızca sahibine açık
// olduğu için service role ile okunur; oda üyeliği önce kullanıcının kendi (RLS'li) istemcisiyle doğrulanır ve yalnızca iki tarafın
// da üyesi olduğu odalar sayılır. Web sunucu eylemi ve mobil uç aynı fonksiyonu kullanır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function participantLastReadAs(
  supabase: SupabaseClient,
  userId: string,
  participantId: unknown,
  roomIds: unknown,
): Promise<string | null> {
  if (typeof participantId !== 'string' || !UUID_RE.test(participantId) || !Array.isArray(roomIds)) return null
  const ids = Array.from(new Set(roomIds.filter((id): id is string => typeof id === 'string' && UUID_RE.test(id)))).slice(0, 50)
  if (!ids.length) return null
  const { data: rooms } = await supabase.from('rooms').select('id, brand_id, influencer_id').in('id', ids)
  const shared = ((rooms ?? []) as Array<{ id: string; brand_id: string | null; influencer_id: string | null }>)
    .filter((r) => [r.brand_id, r.influencer_id].includes(userId) && [r.brand_id, r.influencer_id].includes(participantId))
    .map((r) => r.id)
  if (!shared.length) return null
  const admin = createSupabaseAdminClient()
  if (!admin) return null
  const { data } = await admin
    .from('room_reads')
    .select('last_read_at')
    .eq('user_id', participantId)
    .in('room_id', shared)
    .order('last_read_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.last_read_at as string | undefined) ?? null
}
