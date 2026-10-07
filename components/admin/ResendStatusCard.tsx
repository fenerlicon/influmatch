import { AlertTriangle, CheckCircle2, Info, Mail } from 'lucide-react'
import { domainStatusLabel, type ResendStatus } from '@/lib/resend-status-shared'

const LEVEL_STYLES: Record<ResendStatus['level'], { label: string; className: string }> = {
  ok: { label: 'Sağlıklı', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  warning: { label: 'Dikkat', className: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300' },
  critical: { label: 'Sorun var', className: 'border-red-500/40 bg-red-500/10 text-red-300' },
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
  const color = ratio >= 1 ? 'bg-red-400' : ratio >= 0.8 ? 'bg-yellow-400' : 'bg-emerald-400'
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-gray-300">{label}</span>
        <span className="font-mono tabular-nums text-white">
          {used} / {limit}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
      </div>
    </div>
  )
}

export default function ResendStatusCard({ status }: { status: ResendStatus }) {
  const level = LEVEL_STYLES[status.level]
  const usage = status.usage
  return (
    <section className="mt-10 rounded-3xl border border-white/10 bg-[#0C0D10] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
            <Mail className="h-5 w-5 text-soft-gold" /> E-posta servisi (Resend)
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Kurumsal e-posta doğrulama kodları ve admin uyarıları buradan gider. Ücretsiz planda günde {status.limits.daily}, ayda{' '}
            {status.limits.monthly} e-posta sınırı vardır; dolunca markalara kod gitmez.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${level.className}`}>{level.label}</span>
      </div>

      {(status.problems.length > 0 || status.warnings.length > 0) && (
        <ul className="mt-4 space-y-2">
          {status.problems.map((p) => (
            <li key={p} className="flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {p}
            </li>
          ))}
          {status.warnings.map((w) => (
            <li key={w} className="flex gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <QuotaBar label="Bugün (UTC günü)" used={usage?.daily_used ?? 0} limit={status.limits.daily} />
          <QuotaBar label="Bu ay" used={usage?.monthly_used ?? 0} limit={status.limits.monthly} />
          <p className="text-xs text-gray-500">
            {usage
              ? usage.source === 'resend'
                ? `Resend'in bildirdiği değer (hesaptaki tüm gönderimler dahil). Son güncelleme: ${formatDateTime(usage.updated_at)}`
                : `Bu uygulamanın sayacı (Resend henüz kota bilgisi döndürmedi). Son güncelleme: ${formatDateTime(usage.updated_at)}`
              : 'Henüz gönderim yapılmadı.'}
          </p>
        </div>

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-400">Anahtar</dt>
          <dd className="text-white">{KEY_LABELS[status.key]}</dd>
          <dt className="text-gray-400">Gönderen</dt>
          <dd className="break-words font-mono text-xs text-white">{status.from}</dd>
          <dt className="text-gray-400">Alan adı</dt>
          <dd className="flex items-center gap-1.5 text-white">
            {status.isTestSender ? (
              <span className="text-red-300">Test göndericisi (resend.dev)</span>
            ) : status.domainStatus ? (
              <>
                {status.domainStatus === 'verified' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                {status.fromDomain}: {domainStatusLabel(status.domainStatus)}
              </>
            ) : (
              <span className="text-gray-300">{status.fromDomain ?? '—'}</span>
            )}
          </dd>
          <dt className="text-gray-400">Son hata</dt>
          <dd className="break-words text-white">
            {usage?.last_error ? `${usage.last_error} (${formatDateTime(usage.last_error_at)})` : 'Yok'}
          </dd>
        </dl>
      </div>

      {status.notes.map((n) => (
        <p key={n} className="mt-4 flex gap-2 text-xs text-gray-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {n}
        </p>
      ))}
    </section>
  )
}
