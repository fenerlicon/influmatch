import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { sendMessageAs } from '@/lib/messages'
import { markRoomsRead } from '@/lib/room-reads'

export const dynamic = 'force-dynamic'

/** Mesaj gönderir. Gövde: { roomId, content } */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ success: false, error: 'Oturum gerekli.' }, 401)

  const body = await request.json().catch(() => null)
  if (!body?.roomId || typeof body.content !== 'string') {
    return mobileJson({ success: false, error: 'Geçersiz istek.' }, 400)
  }

  const result = await sendMessageAs(ctx.supabase, ctx.user.id, String(body.roomId), body.content)
  // Web ile aynı: gönderen için oda okundu sayılır (room_reads).
  if (result.success) await markRoomsRead(ctx.supabase, ctx.user.id, [String(body.roomId)])
  return mobileJson(result, result.success ? 200 : 400)
}

/** Odaları okundu işaretler (room_reads). Gövde: { roomIds: string[] } */
export async function PATCH(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ success: false, error: 'Oturum gerekli.' }, 401)

  const body = await request.json().catch(() => null)
  const roomIds: string[] = Array.isArray(body?.roomIds)
    ? body.roomIds.filter((id: unknown): id is string => typeof id === 'string').slice(0, 100)
    : []
  if (roomIds.length === 0) return mobileJson({ success: false, error: 'Geçersiz istek.' }, 400)

  // RLS yalnızca kullanıcının katıldığı odalara yazmaya izin verir.
  const ok = await markRoomsRead(ctx.supabase, ctx.user.id, roomIds)
  return mobileJson(ok ? { success: true } : { success: false, error: 'Okundu bilgisi kaydedilemedi.' }, ok ? 200 : 400)
}
