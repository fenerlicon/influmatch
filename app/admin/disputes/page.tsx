import DisputesPanel from '@/components/admin/disputes/DisputesPanel'
import { Card, CardBody, Notice, PageHeader } from '@/components/ui'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { loadAdminDisputes } from '@/lib/collaboration-disputes'

export const revalidate = 0

const FILTERS = ['escalated', 'active', 'closed', 'all'] as const
type Filter = (typeof FILTERS)[number]

// Ödeme / teslim anlaşmazlıkları (2026-11-23). Yetki: app/admin/layout.tsx (yalnızca DB rolü admin); eylemler ayrıca kontrol eder.
export default async function AdminDisputesPage({ searchParams }: { searchParams?: { durum?: string } }) {
  const filter: Filter = (FILTERS as readonly string[]).includes(searchParams?.durum ?? '') ? (searchParams!.durum as Filter) : 'escalated'
  const admin = createSupabaseAdminClient()
  if (!admin) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Anlaşmazlıklar" />
        <Notice tone="danger">Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.</Notice>
      </div>
    )
  }

  let data: Awaited<ReturnType<typeof loadAdminDisputes>>
  try {
    data = await loadAdminDisputes(admin, filter)
  } catch (error) {
    console.error('[admin/disputes]', error)
    return (
      <div className="max-w-2xl">
        <PageHeader title="Anlaşmazlıklar" />
        <Notice tone="danger">Anlaşmazlıklar yüklenemedi. Sayfayı yenileyin.</Notice>
      </div>
    )
  }

  if (!data.available) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Anlaşmazlıklar" />
        <Card>
          <CardBody className="text-[13px] text-ink-muted">
            Güvenli iş birliği tabloları veritabanında henüz yok. <code>supabase/manual/2026-11-23_guvenli_is_birligi.sql</code> dosyasını Supabase SQL
            Editor&apos;de çalıştırın. O zamana kadar &quot;Ödeme alamadım&quot; bildirimleri yalnızca destek talebi olarak gelir.
          </CardBody>
        </Card>
      </div>
    )
  }

  return <DisputesPanel disputes={data.disputes} counts={data.counts} filter={filter} />
}
