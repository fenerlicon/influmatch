import { redirect } from 'next/navigation'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import AppealBox from '@/components/appeals/AppealBox'
import { Card, CardBody, Notice, PageHeader } from '@/components/ui'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { holdNoticeFor } from '@/lib/collaboration-disputes'
import { loadUserDecisions } from '@/lib/moderation'

export const revalidate = 0

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

// Hesap durumu (2026-11-23): ödeme / teslim anlaşmazlığından doğan inceleme ya da askıya alma ve karara itiraz.
export default async function AccountStatusPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createSupabaseAdminClient()
  const [hold, decisions] = await Promise.all([
    holdNoticeFor(user.id, admin),
    loadUserDecisions(admin, user.id, { subjectType: 'collaboration_dispute', limit: 10 }),
  ])

  return (
    <div className="grid max-w-2xl gap-4">
      <PageHeader title="Hesap durumu" description="Ödeme ve teslim bildirimlerinden doğan kısıtlar ve kararlar." />
      {hold ? (
        <Notice tone={hold.kind === 'suspended' ? 'danger' : 'warning'} icon={ShieldAlert} title={hold.kind === 'suspended' ? 'Hesabın askıya alındı.' : 'Hesabın incelemede.'}>
          {formatDate(hold.since)} tarihinden beri yeni ilan, teklif ve başvuru yapamazsın.{hold.reason ? ` ${hold.reason}` : ''}
        </Notice>
      ) : (
        <Notice tone="success" icon={ShieldCheck} title="Hesabında kısıt yok." />
      )}
      {decisions.decisions.length > 0 && (
        <Card>
          <CardBody className="grid gap-4">
            {decisions.decisions.map((d) => (
              <div key={d.id} className="grid gap-2 border-b border-line pb-4 last:border-b-0 last:pb-0">
                <p className="text-[13.5px] text-ink">
                  Askıya alma kararı · <span className="text-ink-muted">{formatDate(d.decidedAt)}</span>
                </p>
                {(d.canAppeal || d.appeal) && <AppealBox decision={d} className="grid gap-2.5 rounded-xl border border-line bg-surface-2 p-3.5 text-[13px]" />}
                {!d.canAppeal && !d.appeal && <p className="text-xs text-ink-faint">Neden: {d.reason}{d.current ? '' : ' · Karar artık geçerli değil.'}</p>}
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  )
}
