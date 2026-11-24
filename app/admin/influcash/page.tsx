import InflucashAdmin from '@/components/admin/influcash/InflucashAdmin'
import { Card, CardBody, Notice, PageHeader } from '@/components/ui'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { loadInflucashAdmin } from '@/lib/influcash'

export const revalidate = 0

// Influcash (2026-11-23). Yetki: app/admin/layout.tsx (yalnızca DB rolü admin); eylemler ayrıca kontrol eder.
export default async function AdminInflucashPage() {
  const admin = createSupabaseAdminClient()
  if (!admin) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Influcash" />
        <Notice tone="danger">Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.</Notice>
      </div>
    )
  }
  const data = await loadInflucashAdmin(admin)
  if (!data.settings.ready) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Influcash" />
        <Card>
          <CardBody className="text-[13px] text-ink-muted">
            Influcash tabloları veritabanında henüz yok. <code>supabase/manual/2026-11-23_influcash.sql</code> dosyasını Supabase SQL Editor&apos;de çalıştırın
            (görev ve ödeme SQL&apos;lerinden sonra). O zamana kadar puan yazılmaz ve arayüz gizli kalır.
          </CardBody>
        </Card>
      </div>
    )
  }
  return <InflucashAdmin data={data} />
}
