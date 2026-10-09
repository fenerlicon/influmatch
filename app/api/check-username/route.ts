import { createSupabaseServerClient } from '@/utils/supabase/server'
import { getBearerUser } from '@/lib/mobile-auth'
import { isUsernameTaken } from '@/lib/profile-reads'
import { NextRequest, NextResponse } from 'next/server'
import { validateUsername } from '@/utils/usernameValidation'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const username = searchParams.get('username')

  if (!username || username.trim().length === 0) {
    return NextResponse.json({ available: false, error: 'Kullanıcı adı boş olamaz.' }, { status: 400 })
  }

  // Validate username format (Instagram rules)
  const validation = validateUsername(username)
  if (!validation.isValid) {
    return NextResponse.json({ available: false, error: validation.error }, { status: 400 })
  }

  const normalizedUsername = validation.normalized || username.trim().toLowerCase()

  // Hariç tutulacak kullanıcı istemciden alınmaz, oturumdan okunur (web çerezi ya da mobil Bearer token). Sorgu
  // service role ile yapılır (lib/profile-reads.ts): başka hesapların satırları istemci oturumuyla okunamaz.
  // Yanıtta yalnızca müsaitlik bilgisi döner.
  const user = request.headers.get('authorization')
    ? await getBearerUser(request)
    : (await createSupabaseServerClient().auth.getUser()).data.user

  try {
    const taken = await isUsernameTaken(normalizedUsername, user?.id ?? null)
    return NextResponse.json({ available: !taken, normalized: normalizedUsername })
  } catch (error) {
    console.error('Username check error:', error)
    return NextResponse.json({ available: false, error: 'Kullanıcı adı kontrol edilemedi.' }, { status: 500 })
  }
}
