'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Clock, KeyRound, Mail, Plus, Power, RefreshCw, Trash2 } from 'lucide-react'
import {
  addApiKey,
  checkApiKeys,
  deleteApiKey,
  moveApiKey,
  sendTestAlertEmail,
  setApiKeyEnabled,
} from '@/app/admin/api-keys/actions'
import type { ApiKeyDashboard, ApiKeyView } from '@/app/admin/api-keys/data'
import type { ApiKeyStatus, ApiProvider } from '@/lib/api-keys'
import ResendStatusCard from '@/components/admin/ResendStatusCard'
import { Button, Card, CardHeader, Chip, ConfirmDialog, Eyebrow, Input, Notice, PageHeader, type ChipTone } from '@/components/ui'
import { cn } from '@/utils/cn'

const PROVIDERS: { id: ApiProvider; name: string; usage: string; placeholder: string }[] = [
  {
    id: 'apify',
    name: 'Apify',
    usage: 'Instagram/TikTok verileri, kayıt sırasında hesap doğrulama ve günlük istatistik yenileme.',
    placeholder: 'apify_api_...',
  },
]

const STATUS: Record<ApiKeyStatus, { label: string; tone: ChipTone }> = {
  unknown: { label: 'Kontrol edilmedi', tone: 'neutral' },
  active: { label: 'Aktif', tone: 'success' },
  low_credit: { label: 'Kredi azaldı', tone: 'warning' },
  exhausted: { label: 'Kredi/kota bitti', tone: 'warning' },
  rate_limited: { label: 'Hız limiti', tone: 'info' },
  invalid: { label: 'Geçersiz', tone: 'danger' },
  error: { label: 'Hata', tone: 'danger' },
}

const HOUR_MS = 60 * 60 * 1000

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
}

function isInCooldown(key: ApiKeyView) {
  return !!key.cooldown_until && new Date(key.cooldown_until).getTime() > Date.now()
}

function isUsable(key: ApiKeyView) {
  return key.is_enabled && key.status !== 'invalid' && !isInCooldown(key)
}

export default function ApiKeysPanel({ initialDashboard }: { initialDashboard: ApiKeyDashboard }) {
  const [dashboard, setDashboard] = useState(initialDashboard)
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<ApiKeyView | null>(null)
  const [forms, setForms] = useState<Record<ApiProvider, { label: string; secret: string }>>({
    apify: { label: '', secret: '' },
  })

  const run = (busyKey: string, action: () => ReturnType<typeof checkApiKeys>, onSuccess?: () => void) => {
    setBusyId(busyKey)
    startTransition(async () => {
      try {
        const result = await action()
        if (result.success) {
          setDashboard(result.dashboard)
          if (result.message) toast.success(result.message)
          onSuccess?.()
        } else {
          toast.error(result.error)
        }
      } catch (error) {
        console.error(error)
        toast.error('İşlem sırasında bir hata oluştu.')
      } finally {
        setBusyId(null)
      }
    })
  }

  const handleAdd = (provider: ApiProvider) => (event: FormEvent) => {
    event.preventDefault()
    const { label, secret } = forms[provider]
    if (!secret.trim()) {
      toast.error('Anahtarı yapıştırın.')
      return
    }
    run(`add:${provider}`, () => addApiKey(provider, label, secret), () =>
      setForms((prev) => ({ ...prev, [provider]: { label: '', secret: '' } })),
    )
  }

  const lastRunAge = dashboard.lastRun?.ran_at ? Date.now() - new Date(dashboard.lastRun.ran_at).getTime() : null
  const cronHealthy = lastRunAge !== null && lastRunAge < 2 * HOUR_MS
  const isBusy = (key: string) => isPending && busyId === key

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="API anahtarları"
        description="Her servis için birden fazla anahtar ekleyin. Kredisi/kotası biten ya da geçersizleşen anahtardan sonra sıradakine geçilir; sıra yukarıdan aşağıya önceliktir."
        actions={
          <Button variant="primary" onClick={() => run('check-all', () => checkApiKeys())} loading={isBusy('check-all')} disabled={isPending} leftIcon={<RefreshCw />}>
            Tümünü kontrol et
          </Button>
        }
      />

      <div className="grid gap-4">
        {dashboard.loadError && <Notice tone="danger">{dashboard.loadError}</Notice>}

        {/* Otomatik kontrol ve e-posta uyarıları */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card padded className={cn(!cronHealthy && 'border-warning/40')}>
            <Eyebrow className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" aria-hidden /> Saatlik otomatik kontrol</Eyebrow>
            {dashboard.lastRun ? (
              <p className="mt-2 text-[13.5px] text-ink">
                Son çalışma: {formatDateTime(dashboard.lastRun.ran_at)}
                {dashboard.lastRun.has_problems && <span className="ml-2 text-warning">(sorun bulundu)</span>}
              </p>
            ) : (
              <p className="mt-2 text-[13.5px] text-warning">Henüz hiç çalışmadı.</p>
            )}
            {!cronHealthy && (
              <p className="mt-2 text-xs text-ink-muted">
                Supabase SQL Editor&apos;de <code className="text-ink">supabase/cron/hourly_jobs.sql</code> dosyasını bir kez çalıştırın.
              </p>
            )}
            {dashboard.lastRun?.email_error && (
              <p className="mt-2 text-xs text-danger">Son e-posta gönderilemedi: {dashboard.lastRun.email_error}</p>
            )}
            <p className="mt-3 text-xs text-ink-faint">Elle kontrol kredi harcamaz; tüm etkin anahtarların kredisine ve geçerliliğine bakar.</p>
          </Card>

          <Card padded className={cn(!dashboard.email.configured && 'border-warning/40')}>
            <Eyebrow className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" aria-hidden /> E-posta uyarıları</Eyebrow>
            {dashboard.email.configured ? (
              <p className="mt-2 break-words text-[13.5px] text-ink">
                Alıcı: {dashboard.email.recipients.length ? dashboard.email.recipients.join(', ') : <span className="text-warning">bulunamadı</span>}
              </p>
            ) : (
              <p className="mt-2 text-[13.5px] text-warning">Kapalı: Vercel ortam değişkenlerine RESEND_API_KEY ekleyin.</p>
            )}
            <Button
              size="sm"
              className="mt-3"
              onClick={() => run('email', () => sendTestAlertEmail())}
              loading={isBusy('email')}
              disabled={isPending || !dashboard.email.configured}
              leftIcon={<Mail />}
            >
              Test e-postası gönder
            </Button>
          </Card>
        </div>

        <ResendStatusCard status={dashboard.resend} />

        {/* Servisler */}
        {PROVIDERS.map((provider) => {
          const keys = dashboard.keys.filter((key) => key.provider === provider.id)
          const enabled = keys.filter((key) => key.is_enabled)
          const usable = enabled.filter(isUsable).length
          const credited = enabled.filter((key) => key.credit_limit_usd !== null && key.credit_used_usd !== null)
          const remaining = credited.reduce(
            (sum, key) => sum + Math.max(Number(key.credit_limit_usd) - Number(key.credit_used_usd), 0),
            0,
          )
          const poolDown = enabled.length > 0 && usable === 0

          return (
            <Card key={provider.id}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <KeyRound className="h-[18px] w-[18px] text-gold" aria-hidden /> {provider.name}
                  </span>
                }
                description={provider.usage}
                action={
                  <div className="flex flex-wrap gap-2">
                    <Chip tone={poolDown ? 'danger' : 'neutral'}>{usable}/{enabled.length} kullanılabilir</Chip>
                    {credited.length > 0 && <Chip>Kalan kredi: ${remaining.toFixed(2)}</Chip>}
                  </div>
                }
              />

              {poolDown && (
                <div className="px-5 pt-4">
                  <Notice tone="danger">Kullanılabilir anahtar kalmadı. Bu servise bağlı özellikler çalışmıyor; yeni anahtar ekleyin.</Notice>
                </div>
              )}

              {keys.length === 0 && (
                <p className="px-5 pt-4 text-[13px] text-ink-muted">
                  Henüz anahtar yok.
                  {dashboard.envKeys[provider.id] &&
                    ' Ortam değişkenindeki anahtar ilk kullanımda (veya ilk otomatik kontrolde) buraya otomatik eklenecek.'}
                </p>
              )}

              <div>
                {keys.map((key, index) => {
                  const status = STATUS[key.status]
                  const used = Number(key.credit_used_usd)
                  const limit = Number(key.credit_limit_usd)
                  const hasCredit = key.credit_limit_usd !== null && key.credit_used_usd !== null && limit > 0
                  const usedPercent = hasCredit ? Math.min((used / limit) * 100, 100) : 0

                  return (
                    <div key={key.id} className={cn('flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-start lg:justify-between', !key.is_enabled && 'opacity-60')}>
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            iconOnly
                            aria-label="Yukarı taşı"
                            onClick={() => run(`move:${key.id}`, () => moveApiKey(key.id, 'up'))}
                            disabled={isPending || index === 0}
                          >
                            <ArrowUp />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            iconOnly
                            aria-label="Aşağı taşı"
                            onClick={() => run(`move:${key.id}`, () => moveApiKey(key.id, 'down'))}
                            disabled={isPending || index === keys.length - 1}
                          >
                            <ArrowDown />
                          </Button>
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs tabular-nums text-ink-faint">#{index + 1}</span>
                            <p className="truncate font-semibold text-ink">{key.label}</p>
                            <Chip tone={status.tone} dot>{status.label}</Chip>
                            {!key.is_enabled && <Chip>Pasif</Chip>}
                          </div>
                          <p className="mt-1 font-mono text-xs text-ink-faint">{key.masked}</p>
                          {key.status_message && <p className="mt-2 text-[13px] text-ink-muted">{key.status_message}</p>}
                          {isInCooldown(key) && (
                            <p className="mt-1 text-xs text-info">Tekrar denenecek: {formatDateTime(key.cooldown_until)}</p>
                          )}
                          {hasCredit && (
                            <div className="mt-3 max-w-sm">
                              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                                <div className={cn('h-full rounded-full', usedPercent >= 80 ? 'bg-warning' : 'bg-success')} style={{ width: `${usedPercent}%` }} />
                              </div>
                              <p className="mt-1 text-xs text-ink-faint">
                                ${used.toFixed(2)} / ${limit.toFixed(2)} kullanıldı
                                {key.credit_resets_at && ` · yenilenme ${formatDateTime(key.credit_resets_at)}`}
                              </p>
                            </div>
                          )}
                          <p className="mt-2 text-xs text-ink-faint">
                            Son kullanım: {formatDateTime(key.last_used_at)} · Son kontrol: {formatDateTime(key.last_checked_at)} ·
                            Başarılı {key.success_count} / Hatalı {key.failure_count}
                          </p>
                          {key.last_error && key.status !== 'active' && (
                            <p className="mt-1 break-words text-xs text-danger" title={key.last_error}>
                              Son hata ({formatDateTime(key.last_failure_at)}): {key.last_error}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button size="sm" onClick={() => run(`check:${key.id}`, () => checkApiKeys(key.id))} loading={isBusy(`check:${key.id}`)} disabled={isPending} leftIcon={<RefreshCw />}>
                          Kontrol et
                        </Button>
                        <Button size="sm" onClick={() => run(`toggle:${key.id}`, () => setApiKeyEnabled(key.id, !key.is_enabled))} disabled={isPending} leftIcon={<Power />}>
                          {key.is_enabled ? 'Pasif yap' : 'Aktif yap'}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setToDelete(key)} disabled={isPending} leftIcon={<Trash2 />}>
                          Sil
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <form onSubmit={handleAdd(provider.id)} className="grid gap-3 p-5 md:grid-cols-[1fr_2fr_auto]">
                <Input
                  type="text"
                  aria-label="Etiket"
                  value={forms[provider.id].label}
                  onChange={(e) => setForms((prev) => ({ ...prev, [provider.id]: { ...prev[provider.id], label: e.target.value } }))}
                  placeholder="Etiket (ör. Hesap 2)"
                  maxLength={80}
                />
                <Input
                  type="password"
                  autoComplete="off"
                  aria-label={`${provider.name} anahtarı`}
                  className="font-mono placeholder:font-sans"
                  value={forms[provider.id].secret}
                  onChange={(e) => setForms((prev) => ({ ...prev, [provider.id]: { ...prev[provider.id], secret: e.target.value } }))}
                  placeholder={`${provider.name} anahtarı (${provider.placeholder})`}
                />
                <Button type="submit" loading={isBusy(`add:${provider.id}`)} disabled={isPending} leftIcon={<Plus />}>
                  Ekle ve doğrula
                </Button>
              </form>
            </Card>
          )
        })}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) run(`delete:${toDelete.id}`, () => deleteApiKey(toDelete.id), () => setToDelete(null))
        }}
        loading={!!toDelete && isBusy(`delete:${toDelete.id}`)}
        tone="danger"
        title="Anahtar silinsin mi?"
        description={toDelete ? `"${toDelete.label}" anahtarı kalıcı olarak silinir.` : undefined}
        confirmLabel="Sil"
      />
    </div>
  )
}
