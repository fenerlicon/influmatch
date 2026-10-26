import AppealsPanel from '@/components/admin/AppealsPanel'
import { Card, CardBody, Notice, PageHeader } from '@/components/ui'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { MODERATION_SUBJECT_TYPES, loadAdminAppeals, type AppealStatus, type ModerationSubjectType } from '@/lib/moderation'

export const revalidate = 0

const STATUSES: Array<AppealStatus | 'all'> = ['open', 'accepted', 'rejected', 'all']

// İtirazlar (2026-10-26). Yetki: app/admin/layout.tsx (yalnızca DB rolü admin); eylemler ayrıca kontrol eder.
export default async function AdminAppealsPage({ searchParams }: { searchParams?: { durum?: string; tur?: string } }) {
  const status = (STATUSES as string[]).includes(searchParams?.durum ?? '') ? (searchParams!.durum as AppealStatus | 'all') : 'open'
  const type = (MODERATION_SUBJECT_TYPES as readonly string[]).includes(searchParams?.tur ?? '') ? (searchParams!.tur as ModerationSubjectType) : 'all'

  const admin = createSupabaseAdminClient()
  if (!admin) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="İtirazlar" />
        <Notice tone="danger">Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.</Notice>
      </div>
    )
  }

  let data: Awaited<ReturnType<typeof loadAdminAppeals>>
  try {
    data = await loadAdminAppeals(admin, { status, type })
  } catch (error) {
    console.error('[admin/appeals]', error)
    return (
      <div className="max-w-2xl">
        <PageHeader title="İtirazlar" />
        <Notice tone="danger">İtirazlar yüklenemedi. Sayfayı yenileyin.</Notice>
      </div>
    )
  }

  if (!data.available) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="İtirazlar" />
        <Card>
          <CardBody className="text-[13px] text-ink-muted">
            İtiraz tabloları veritabanında henüz yok. <code>supabase/manual/2026-10-26_ret_nedeni_itiraz.sql</code> dosyasını Supabase SQL
            Editor&apos;de çalıştırın. O zamana kadar retler nedenle birlikte bildirilir ama karar kaydı ve itiraz yoktur.
          </CardBody>
        </Card>
      </div>
    )
  }

  return <AppealsPanel appeals={data.appeals} counts={data.counts} status={status} type={type} />
}
