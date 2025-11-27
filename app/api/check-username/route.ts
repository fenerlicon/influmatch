import { createSupabaseServerClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateUsername } from '@/utils/usernameValidation'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const username = searchParams.get('username')
  const excludeUserId = searchParams.get('excludeUserId') // For updates, exclude current user

  if (!username || username.trim().length === 0) {
    return NextResponse.json({ available: false, error: 'Kullanıcı adı boş olamaz.' }, { status: 400 })
  }

  // Validate username format (Instagram rules)
  const validation = validateUsername(username)
  if (!validation.isValid) {
    return NextResponse.json({ available: false, error: validation.error }, { status: 400 })
  }

  const normalizedUsername = validation.normalized || username.trim().toLowerCase()

  const supabase = createSupabaseServerClient()
  
  let query = supabase
    .from('users')
    .select('id')
    .eq('username', normalizedUsername)
    .limit(1)

  // If updating, exclude current user from check
  if (excludeUserId) {
    query = query.neq('id', excludeUserId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Username check error:', error)
    return NextResponse.json({ available: false, error: 'Kullanıcı adı kontrol edilemedi.' }, { status: 500 })
  }

  const isAvailable = !data || data.length === 0

  return NextResponse.json({ available: isAvailable, normalized: normalizedUsername })
}

