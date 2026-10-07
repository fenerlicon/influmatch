import { redirect } from 'next/navigation'
import AdminPanel from '@/components/admin/AdminPanel'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { ADMIN_USER_SELECT } from '@/lib/user-columns'
import { loadLatestTaxVerifications } from '@/lib/tax-verification'
import { loadLastSeen } from '@/lib/presence'


export default async function AdminPage() {
  const supabase = createSupabaseServerClient()

  // redirect() bir istisna fırlatarak çalışır; try içinde kalırsa aşağıdaki catch onu yakalayıp
  // "Bir Hata Oluştu" ekranı gösteriyordu. Oturum kontrolü bu yüzden try dışında.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login?redirectedFrom=/admin')
  }

  try {

    // Check if user is admin
    const { data: adminProfile, error: adminError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (adminError) {
      console.error('[AdminPage] Admin check error:', adminError.message)
      // If rate limit error, show a helpful message
      const isRateLimit =
        adminError.message?.includes('rate limit') ||
        adminError.message?.includes('429')

      if (isRateLimit) {
        throw new Error('Veritabanı geçici olarak yanıt vermiyor (rate limit). Lütfen birkaç dakika bekleyip tekrar deneyin.')
      }
    }

    const isAdmin = adminProfile?.role === 'admin'

    console.log('[AdminPage] Access Check:', {
      userId: user.id,
      role: adminProfile?.role,
      isAdmin,
    })

    if (!isAdmin) {
      console.log('[AdminPage] Access Denied.')
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0C10] p-4 text-white">
          <div className="max-w-md rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center">
            <h1 className="mb-4 text-2xl font-bold text-red-400">Erişim Reddedildi</h1>
            <p className="mb-6 text-gray-300">Bu sayfayı görüntüleme yetkiniz bulunmuyor.</p>

            <a
              href="/dashboard"
              className="rounded-xl bg-white/10 px-6 py-3 font-semibold transition hover:bg-white/20"
            >
              Dashboard'a Dön
            </a>
          </div>
        </div>
      )
    }

    // Hassas kolonlar (e-posta, vergi no, admin notu) istemci rollerine kapalı; admin listesi service role ile okunur.
    const supabaseAdmin = createSupabaseAdminClient()
    if (!supabaseAdmin) {
      throw new Error('Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.')
    }

    // Optimize: Fetch all users in a single query to reduce rate limit issues
    // Add retry mechanism for maintenance periods
    let allUsers = null
    let usersError = null
    const maxRetries = 3
    const retryDelay = 2000 // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await supabaseAdmin
        .from('users')
        .select(ADMIN_USER_SELECT)
        .order('created_at', { ascending: false })

      if (result.error) {
        usersError = result.error
        const isRateLimit =
          result.error.message?.toLowerCase().includes('rate limit') ||
          result.error.message?.includes('429') ||
          result.error.message?.toLowerCase().includes('too many requests') ||
          (result.error as unknown as { status?: number }).status === 429

        // If rate limit and not last attempt, retry
        if (isRateLimit && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt))
          continue
        }

        // If rate limit on last attempt or other error, throw
        if (isRateLimit) {
          throw new Error(
            'Veritabanı şu an yoğun (rate limit). Lütfen birkaç dakika bekleyip tekrar deneyin.'
          )
        }

        // Other errors
        console.error('[AdminPage] Users query error:', result.error.message)
        throw new Error(`Veri yüklenirken hata oluştu: ${result.error.message}`)
      }

      allUsers = result.data
      break // Success, exit retry loop
    }

    // Filter and count on server side (single query instead of 6)
    const brandIds = (allUsers ?? []).filter((user) => user.role === 'brand').map((user) => user.id)
    const [taxVerifications, lastSeen] = await Promise.all([
      loadLatestTaxVerifications(supabaseAdmin, brandIds),
      loadLastSeen(supabaseAdmin),
    ])
    const allUsersList = (allUsers ?? []).map((user) => ({ ...user, tax_verification: taxVerifications[user.id] ?? null }))

    // Filter by verification status
    const pendingUsers = allUsersList
      .filter((user) => user.verification_status === 'pending')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const verifiedUsers = allUsersList
      .filter((user) => user.verification_status === 'verified')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const rejectedUsers = allUsersList
      .filter((user) => user.verification_status === 'rejected')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // Count by role
    const totalUsers = allUsersList.length
    const influencerCount = allUsersList.filter((user) => user.role === 'influencer').length
    const brandCount = allUsersList.filter((user) => user.role === 'brand').length

    return (
      <AdminPanel
        pendingUsers={pendingUsers ?? []}
        verifiedUsers={verifiedUsers ?? []}
        rejectedUsers={rejectedUsers ?? []}
        totalUsers={totalUsers ?? 0}
        influencerCount={influencerCount ?? 0}
        brandCount={brandCount ?? 0}
        initialLastSeen={lastSeen}
      />
    )
  } catch (error) {
    console.error('[AdminPage] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Bir hata oluştu'

    // If rate limit or maintenance error, redirect to a page with error message
    if (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('Rate limit') ||
      errorMessage.includes('maintenance') ||
      errorMessage.includes('Maintenance')
    ) {
      redirect(`/login?error=rate_limit&message=${encodeURIComponent(errorMessage)}`)
    }

    // For other errors, redirect to dashboard
    // For other errors, show error UI instead of redirecting
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0C10] p-4 text-white">
        <div className="max-w-md rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center">
          <h1 className="mb-4 text-2xl font-bold text-red-400">Bir Hata Oluştu</h1>
          <p className="mb-6 text-gray-300">Admin paneli yüklenirken bir sorun oluştu.</p>

          <div className="mb-6 rounded-xl bg-black/50 p-4 text-left text-xs font-mono text-gray-400 overflow-auto max-h-40">
            <p className="text-red-300">{errorMessage}</p>
          </div>

          <a
            href="/dashboard"
            className="rounded-xl bg-white/10 px-6 py-3 font-semibold transition hover:bg-white/20"
          >
            Dashboard'a Dön
          </a>
        </div>
      </div>
    )
  }
}

