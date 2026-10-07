'use client'

import { useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Clock, KeyRound, Loader2, Mail, Plus, Power, RefreshCw, Trash2 } from 'lucide-react'
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

const PROVIDERS: { id: ApiProvider; name: string; usage: string; placeholder: string }[] = [
  {
    id: 'apify',
    name: 'Apify',
    usage: 'Instagram/TikTok verileri, kayıt sırasında hesap doğrulama ve günlük istatistik yenileme.',
    placeholder: 'apify_api_...',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    usage: 'Şu an hiçbir modül kullanmıyor (vergi levhası kontrolü sunucuda, yapay zekasız yapılır). İleride kişisel veri içermeyen yapay zeka modülleri için; ücretsiz katmana gönderilen veriler Google tarafından incelenebilir.',
    placeholder: 'AIza...',
  },
]

const STATUS_STYLES: Record<ApiKeyStatus, { label: string; className: string }> = {
  unknown: { label: 'Kontrol edilmedi', className: 'border-white/10 bg-white/5 text-gray-300' },
  active: { label: 'Aktif', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  low_credit: { label: 'Kredi azaldı', className: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300' },
  exhausted: { label: 'Kredi/kota bitti', className: 'border-orange-500/40 bg-orange-500/10 text-orange-300' },
  rate_limited: { label: 'Hız limiti', className: 'border-sky-500/40 bg-sky-500/10 text-sky-300' },
  invalid: { label: 'Geçersiz', className: 'border-red-500/40 bg-red-500/10 text-red-300' },
  error: { label: 'Hata', className: 'border-red-500/40 bg-red-500/10 text-red-300' },
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
  const [forms, setForms] = useState<Record<ApiProvider, { label: string; secret: string }>>({
    apify: { label: '', secret: '' },
    gemini: { label: '', secret: '' },
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
    <main className="min-h-screen bg-background px-4 py-16 sm:px-6 md:px-12 lg:px-24">
      <div className="mx-auto max-w-6xl">
        <div className="glass-panel rounded-[32px] p-6 sm:p-10">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-soft-gold">Admin Paneli</p>
              <h1 className="mt-4 text-3xl font-semibold text-white">API Anahtarları</h1>
              <p className="mt-2 max-w-2xl text-gray-300">
                Her servis için birden fazla anahtar ekleyin. Bir anahtarın kredisi/kotası biterse veya geçersizleşirse
                sistem otomatik olarak sıradakine geçer. Sıra, yukarıdan aşağıya kullanım önceliğidir.
              </p>
            </div>
            <Link
              href="/admin"
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm text-gray-200 transition hover:border-soft-gold hover:text-soft-gold"
            >
              <ArrowLeft className="h-4 w-4" /> Hesap Yönetimi
            </Link>
          </div>

          {dashboard.loadError && (
            <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
              {dashboard.loadError}
            </div>
          )}

          {/* Otomatik kontrol ve e-posta durumu */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className={`rounded-2xl border p-4 ${cronHealthy ? 'border-white/10 bg-white/5' : 'border-yellow-500/40 bg-yellow-500/10'}`}>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gray-400">
                <Clock className="h-4 w-4" /> Saatlik otomatik kontrol
              </div>
              {dashboard.lastRun ? (
                <p className="mt-2 text-sm text-white">
                  Son çalışma: {formatDateTime(dashboard.lastRun.ran_at)}
                  {dashboard.lastRun.has_problems && <span className="ml-2 text-yellow-300">(sorun bulundu)</span>}
                </p>
              ) : (
                <p className="mt-2 text-sm text-yellow-200">Henüz hiç çalışmadı.</p>
              )}
              {!cronHealthy && (
                <p className="mt-2 text-xs text-yellow-200/80">
                  Supabase SQL Editor&apos;de <code className="text-yellow-100">supabase/cron/hourly_jobs.sql</code> dosyasını bir kez çalıştırın.
                </p>
              )}
              {dashboard.lastRun?.email_error && (
                <p className="mt-2 text-xs text-red-300">Son e-posta gönderilemedi: {dashboard.lastRun.email_error}</p>
              )}
            </div>

            <div className={`rounded-2xl border p-4 ${dashboard.email.configured ? 'border-white/10 bg-white/5' : 'border-yellow-500/40 bg-yellow-500/10'}`}>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gray-400">
                <Mail className="h-4 w-4" /> E-posta uyarıları
              </div>
              {dashboard.email.configured ? (
                <p className="mt-2 break-words text-sm text-white">
                  Alıcı: {dashboard.email.recipients.length ? dashboard.email.recipients.join(', ') : <span className="text-yellow-200">bulunamadı</span>}
                </p>
              ) : (
                <p className="mt-2 text-sm text-yellow-200">Kapalı: Vercel ortam değişkenlerine RESEND_API_KEY ekleyin.</p>
              )}
              <button
                type="button"
                onClick={() => run('email', () => sendTestAlertEmail())}
                disabled={isPending || !dashboard.email.configured}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-soft-gold/40 bg-soft-gold/10 px-3 py-1.5 text-xs font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBusy('email') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                Test e-postası gönder
              </button>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gray-400">
                  <RefreshCw className="h-4 w-4" /> Manuel kontrol
                </div>
                <p className="mt-2 text-sm text-gray-300">Tüm etkin anahtarların kredisini ve geçerliliğini şimdi kontrol eder (kredi harcamaz).</p>
              </div>
              <button
                type="button"
                onClick={() => run('check-all', () => checkApiKeys())}
                disabled={isPending}
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-soft-gold px-4 py-2 text-sm font-semibold text-background transition hover:bg-champagne disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBusy('check-all') ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Tümünü şimdi kontrol et
              </button>
            </div>
          </div>

          <ResendStatusCard status={dashboard.resend} />

          {/* Servisler */}
          <div className="mt-10 space-y-10">
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
                <section key={provider.id} className="rounded-3xl border border-white/10 bg-[#0C0D10] p-5 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
                        <KeyRound className="h-5 w-5 text-soft-gold" /> {provider.name}
                      </h2>
                      <p className="mt-1 text-sm text-gray-400">{provider.usage}</p>
                      {provider.id === 'gemini' && (
                        <p className="mt-1 text-xs text-gray-500">Model: {dashboard.geminiModel}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className={`rounded-full border px-3 py-1 ${poolDown ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-white/10 bg-white/5 text-gray-300'}`}>
                        {usable}/{enabled.length} kullanılabilir
                      </span>
                      {credited.length > 0 && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-gray-300">
                          Toplam kalan kredi: ${remaining.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  {poolDown && (
                    <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      Kullanılabilir anahtar kalmadı. Bu servise bağlı özellikler çalışmıyor; yeni anahtar ekleyin.
                    </div>
                  )}

                  <div className="mt-5 space-y-3">
                    {keys.length === 0 && (
                      <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-gray-400">
                        Henüz anahtar yok.
                        {dashboard.envKeys[provider.id] &&
                          ' Ortam değişkenindeki anahtar ilk kullanımda (veya ilk otomatik kontrolde) buraya otomatik eklenecek.'}
                      </p>
                    )}

                    {keys.map((key, index) => {
                      const style = STATUS_STYLES[key.status]
                      const used = Number(key.credit_used_usd)
                      const limit = Number(key.credit_limit_usd)
                      const hasCredit = key.credit_limit_usd !== null && key.credit_used_usd !== null && limit > 0
                      const usedPercent = hasCredit ? Math.min((used / limit) * 100, 100) : 0

                      return (
                        <div
                          key={key.id}
                          className={`rounded-2xl border border-white/10 bg-white/5 p-4 ${key.is_enabled ? '' : 'opacity-60'}`}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  aria-label="Yukarı taşı"
                                  onClick={() => run(`move:${key.id}`, () => moveApiKey(key.id, 'up'))}
                                  disabled={isPending || index === 0}
                                  className="rounded-lg border border-white/10 p-1 text-gray-400 transition hover:text-white disabled:opacity-30"
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  aria-label="Aşağı taşı"
                                  onClick={() => run(`move:${key.id}`, () => moveApiKey(key.id, 'down'))}
                                  disabled={isPending || index === keys.length - 1}
                                  className="rounded-lg border border-white/10 p-1 text-gray-400 transition hover:text-white disabled:opacity-30"
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-gray-500">#{index + 1}</span>
                                  <p className="truncate font-semibold text-white">{key.label}</p>
                                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.className}`}>{style.label}</span>
                                  {!key.is_enabled && (
                                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-gray-400">Pasif</span>
                                  )}
                                </div>
                                <p className="mt-1 font-mono text-xs text-gray-400">{key.masked}</p>
                                {key.status_message && <p className="mt-2 text-sm text-gray-300">{key.status_message}</p>}
                                {isInCooldown(key) && (
                                  <p className="mt-1 text-xs text-sky-300">Tekrar denenecek: {formatDateTime(key.cooldown_until)}</p>
                                )}
                                {hasCredit && (
                                  <div className="mt-3 max-w-sm">
                                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                      <div
                                        className={`h-full rounded-full ${usedPercent >= 80 ? 'bg-orange-400' : 'bg-emerald-400'}`}
                                        style={{ width: `${usedPercent}%` }}
                                      />
                                    </div>
                                    <p className="mt-1 text-xs text-gray-400">
                                      ${used.toFixed(2)} / ${limit.toFixed(2)} kullanıldı
                                      {key.credit_resets_at && ` · yenilenme ${formatDateTime(key.credit_resets_at)}`}
                                    </p>
                                  </div>
                                )}
                                <p className="mt-2 text-xs text-gray-500">
                                  Son kullanım: {formatDateTime(key.last_used_at)} · Son kontrol: {formatDateTime(key.last_checked_at)} ·
                                  Başarılı {key.success_count} / Hatalı {key.failure_count}
                                </p>
                                {key.last_error && key.status !== 'active' && (
                                  <p className="mt-1 break-words text-xs text-red-300/80" title={key.last_error}>
                                    Son hata ({formatDateTime(key.last_failure_at)}): {key.last_error}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex shrink-0 flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => run(`check:${key.id}`, () => checkApiKeys(key.id))}
                                disabled={isPending}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-gray-200 transition hover:border-soft-gold hover:text-soft-gold disabled:opacity-50"
                              >
                                {isBusy(`check:${key.id}`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                Kontrol et
                              </button>
                              <button
                                type="button"
                                onClick={() => run(`toggle:${key.id}`, () => setApiKeyEnabled(key.id, !key.is_enabled))}
                                disabled={isPending}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-gray-200 transition hover:border-soft-gold hover:text-soft-gold disabled:opacity-50"
                              >
                                <Power className="h-3.5 w-3.5" />
                                {key.is_enabled ? 'Pasif yap' : 'Aktif yap'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`"${key.label}" anahtarı silinsin mi?`)) {
                                    run(`delete:${key.id}`, () => deleteApiKey(key.id))
                                  }
                                }}
                                disabled={isPending}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 px-3 py-1.5 text-xs text-red-300 transition hover:border-red-500 hover:bg-red-500/10 disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Sil
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <form onSubmit={handleAdd(provider.id)} className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[1fr_2fr_auto]">
                    <input
                      type="text"
                      value={forms[provider.id].label}
                      onChange={(e) => setForms((prev) => ({ ...prev, [provider.id]: { ...prev[provider.id], label: e.target.value } }))}
                      placeholder="Etiket (ör. Hesap 2)"
                      maxLength={80}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-soft-gold focus:outline-none"
                    />
                    <input
                      type="password"
                      autoComplete="off"
                      value={forms[provider.id].secret}
                      onChange={(e) => setForms((prev) => ({ ...prev, [provider.id]: { ...prev[provider.id], secret: e.target.value } }))}
                      placeholder={`${provider.name} anahtarı (${provider.placeholder})`}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-sm text-white placeholder:font-sans placeholder:text-gray-500 focus:border-soft-gold focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isPending}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-soft-gold/60 bg-soft-gold/10 px-4 py-2.5 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isBusy(`add:${provider.id}`) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Ekle ve doğrula
                    </button>
                  </form>
                </section>
              )
            })}
          </div>
        </div>
      </div>
    </main>
  )
}
