import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
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

  // Hariç tutulacak kullanıcı istemciden alınmaz, oturumdan okunur. Sorgu service role ile
  // yapılır: oturum açmamış ziyaretçide (anon) users okuma izni olmadığından sonuç her zaman
  // "müsait" çıkıyordu. Yanıtta yalnızca müsaitlik bilgisi döner.
  const {
    data: { user },
  } = await createSupabaseServerClient().auth.getUser()
  const supabase = createSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json({ available: false, error: 'Kullanıcı adı kontrol edilemedi.' }, { status: 500 })
  }

  let query = supabase
    .from('users')
    .select('id')
    .eq('username', normalizedUsername)
    .limit(1)

  if (user) {
    query = query.neq('id', user.id)
  }

  const { data, error } = await query

  if (error) {
    console.error('Username check error:', error)
    return NextResponse.json({ available: false, error: 'Kullanıcı adı kontrol edilemedi.' }, { status: 500 })
  }

  const isAvailable = !data || data.length === 0

  return NextResponse.json({ available: isAvailable, normalized: normalizedUsername })
}

