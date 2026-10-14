import { redirect } from 'next/navigation'
import AdminPanel from '@/components/admin/AdminPanel'
import type { AdminUser } from '@/components/admin/users/types'
import { ButtonLink, Card, CardBody, Notice, PageHeader } from '@/components/ui'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { ADMIN_USER_SELECT } from '@/lib/user-columns'
import { loadLatestTaxVerifications } from '@/lib/tax-verification'
import { loadLastSeen } from '@/lib/presence'

export const revalidate = 0

type DbError = { message?: string; status?: number }

const isRateLimit = (error: DbError) =>
  error.status === 429 ||
  !!error.message?.toLowerCase().includes('rate limit') ||
  !!error.message?.includes('429') ||
  !!error.message?.toLowerCase().includes('too many requests')

// Yetki: app/admin/layout.tsx (yalnızca DB rolü admin). Hassas kolonlar (e-posta, vergi no, admin notu)
// istemci rollerine kapalı; admin listesi service role ile okunur.
export default async function AdminPage() {
  let message = 'Bir hata oluştu'

  try {
    const supabaseAdmin = createSupabaseAdminClient()
    if (!supabaseAdmin) throw new Error('Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.')

    // Tek sorgu; bakım / yoğunluk anında birkaç kez yeniden denenir.
    let users: AdminUser[] = []
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await supabaseAdmin.from('users').select(ADMIN_USER_SELECT).order('created_at', { ascending: false })
      if (!result.error) {
        users = (result.data ?? []) as unknown as AdminUser[]
        break
      }
      const limited = isRateLimit(result.error as DbError)
      if (limited && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
        continue
      }
      throw new Error(
        limited
          ? 'Veritabanı şu an yoğun (rate limit). Lütfen birkaç dakika bekleyip tekrar deneyin.'
          : `Veri yüklenirken hata oluştu: ${result.error.message}`,
      )
    }

    const brandIds = users.filter((u) => u.role === 'brand').map((u) => u.id)
    const [taxVerifications, lastSeen] = await Promise.all([
      loadLatestTaxVerifications(supabaseAdmin, brandIds),
      loadLastSeen(supabaseAdmin),
    ])
    const list = users.map((u) => ({ ...u, tax_verification: taxVerifications[u.id] ?? null }))

    return (
      <AdminPanel
        pendingUsers={list.filter((u) => u.verification_status === 'pending')}
        verifiedUsers={list.filter((u) => u.verification_status === 'verified')}
        rejectedUsers={list.filter((u) => u.verification_status === 'rejected')}
        totalUsers={list.length}
        influencerCount={list.filter((u) => u.role === 'influencer').length}
        brandCount={list.filter((u) => u.role === 'brand').length}
        initialLastSeen={lastSeen}
      />
    )
  } catch (error) {
    console.error('[AdminPage] Error:', error)
    if (error instanceof Error) message = error.message
  }

  // redirect() istisna fırlatarak çalışır; try içinde kalırsa catch onu yutardı.
  if (/rate limit|maintenance/i.test(message)) {
    redirect(`/login?error=rate_limit&message=${encodeURIComponent(message)}`)
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Kullanıcılar" />
      <Card>
        <CardBody className="grid gap-4">
          <Notice tone="danger" title="Admin paneli yüklenemedi.">
            {message}
          </Notice>
          <div>
            <ButtonLink href="/admin" size="sm">Tekrar dene</ButtonLink>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
