import { CheckCircle2, Info, Mail } from 'lucide-react'
import { domainStatusLabel, type ResendStatus } from '@/lib/resend-status-shared'
import { Card, CardBody, CardHeader, Chip, Notice, type ChipTone } from '@/components/ui'
import { cn } from '@/utils/cn'

const LEVELS: Record<ResendStatus['level'], { label: string; tone: ChipTone }> = {
  ok: { label: 'Sağlıklı', tone: 'success' },
  warning: { label: 'Dikkat', tone: 'warning' },
  critical: { label: 'Sorun var', tone: 'danger' },
}

const KEY_LABELS: Record<ResendStatus['key'], string> = {
  ok: 'Geçerli',
  sending_only: 'Geçerli (yalnızca gönderim yetkili)',
  invalid: 'Geçersiz',
  error: 'Kontrol edilemedi',
  missing: 'Tanımlı değil',
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' })
}

function QuotaBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const ratio = limit > 0 ? used / limit : 0
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-ink-muted">{label}</span>
        <span className="tabular-nums text-ink">
          {used} / {limit}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className={cn('h-full rounded-full', ratio >= 1 ? 'bg-danger' : ratio >= 0.8 ? 'bg-warning' : 'bg-success')}
          style={{ width: `${Math.min(ratio, 1) * 100}%` }}
        />
      </div>
    </div>
  )
}

export default function ResendStatusCard({ status }: { status: ResendStatus }) {
  const level = LEVELS[status.level]
  const usage = status.usage
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Mail className="h-[18px] w-[18px] text-gold" aria-hidden /> E-posta servisi (Resend)
          </span>
        }
        description={`Kurumsal e-posta kodları ve admin uyarıları buradan gider. Ücretsiz planda günde ${status.limits.daily}, ayda ${status.limits.monthly} e-posta; dolunca markalara kod gitmez.`}
        action={<Chip tone={level.tone} dot>{level.label}</Chip>}
      />
      <CardBody className="grid gap-5">
        {status.problems.length > 0 || status.warnings.length > 0 ? (
          <div className="grid gap-2">
            {status.problems.map((p) => <Notice key={p} tone="danger">{p}</Notice>)}
            {status.warnings.map((w) => <Notice key={w} tone="warning">{w}</Notice>)}
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="grid content-start gap-4">
            <QuotaBar label="Bugün (UTC günü)" used={usage?.daily_used ?? 0} limit={status.limits.daily} />
            <QuotaBar label="Bu ay" used={usage?.monthly_used ?? 0} limit={status.limits.monthly} />
            <p className="text-xs text-ink-faint">
              {usage
                ? usage.source === 'resend'
                  ? `Resend'in bildirdiği değer (hesaptaki tüm gönderimler dahil). Son güncelleme: ${formatDateTime(usage.updated_at)}`
                  : `Bu uygulamanın sayacı (Resend henüz kota bilgisi döndürmedi). Son güncelleme: ${formatDateTime(usage.updated_at)}`
                : 'Henüz gönderim yapılmadı.'}
            </p>
          </div>

          <dl className="grid grid-cols-[auto_minmax(0,1fr)] content-start gap-x-4 gap-y-2 text-[13px]">
            <dt className="text-ink-faint">Anahtar</dt>
            <dd className="text-ink">{KEY_LABELS[status.key]}</dd>
            <dt className="text-ink-faint">Gönderen</dt>
            <dd className="break-words font-mono text-xs text-ink">{status.from}</dd>
            <dt className="text-ink-faint">Alan adı</dt>
            <dd className="flex items-center gap-1.5 text-ink">
              {status.isTestSender ? (
                <span className="text-danger">Test göndericisi (resend.dev)</span>
              ) : status.domainStatus ? (
                <>
                  {status.domainStatus === 'verified' && <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />}
                  {status.fromDomain}: {domainStatusLabel(status.domainStatus)}
                </>
              ) : (
                <span className="text-ink-muted">{status.fromDomain ?? '—'}</span>
              )}
            </dd>
            <dt className="text-ink-faint">Son hata</dt>
            <dd className="break-words text-ink">
              {usage?.last_error ? `${usage.last_error} (${formatDateTime(usage.last_error_at)})` : 'Yok'}
            </dd>
          </dl>
        </div>

        {status.notes.map((n) => (
          <p key={n} className="flex gap-2 text-xs text-ink-faint">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {n}
          </p>
        ))}
      </CardBody>
    </Card>
  )
}
