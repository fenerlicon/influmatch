'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RefreshCcw } from 'lucide-react'
import {
  Button, Card, CardBody, CardHeader, Chip, ConfirmDialog, EmptyState, Field, Input, ListRow, Modal, Notice, PageHeader, Select, StatCard, Switch, Tabs, type ChipTone,
} from '@/components/ui'
import {
  cancelPaidSubscriptionAction,
  endFreeSubscriptionAction,
  extendSubscriptionAction,
  grantSpotlightAction,
  reconcileSubscriptionAction,
  refundPaymentAction,
  runPromoSweepAction,
  setBillingFlagAction,
  setPromoDateAction,
} from '@/app/admin/billing/actions'
import { PLAN_LABELS, SOURCE_LABELS, STATUS_LABELS, formatTry, isPaidSource, type SubscriptionSource, type SubscriptionStatus } from '@/lib/payments/billing-shared'
import type { BillingSettings, PaymentRow, SubscriptionRow } from '@/lib/payments/subscriptions'

export interface AdminBillingData {
  ready: boolean
  settings: BillingSettings
  promoPeriod: boolean
  iyzico: { configured: boolean; mode: 'sandbox' | 'live' | null; baseUrl: string | null; webhookSignature: boolean }
  store: { apple: boolean; google: boolean }
  filters: { source: string | null; status: string | null }
  counts: Record<string, number>
  subscriptions: SubscriptionRow[]
  payments: PaymentRow[]
  failed: PaymentRow[]
  events: Array<{ id: string; provider: string; event_type: string | null; signature_valid: boolean | null; received_at: string; processed_at: string | null; result: string | null }>
  names: Record<string, string>
}

type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

const STATUS_TONE: Record<string, ChipTone> = { active: 'success', past_due: 'danger', pending: 'warning', canceled: 'neutral', expired: 'neutral' }
const PAY_TONE: Record<string, ChipTone> = { success: 'success', failed: 'danger', refunded: 'neutral', partially_refunded: 'warning', canceled: 'neutral' }

function dt(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function BillingAdminPanel({ data }: { data: AdminBillingData }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [confirmFlag, setConfirmFlag] = useState<{ key: 'payments_enabled' | 'iap_enabled'; value: boolean } | null>(null)
  const [promoEnds, setPromoEnds] = useState(toLocalInput(data.settings.promo_ends_at))
  const [discountUntil, setDiscountUntil] = useState(toLocalInput(data.settings.promo_discount_until))
  const [grant, setGrant] = useState({ user: '', plan: 'ipro', months: 1, note: '' })
  const [extend, setExtend] = useState<{ id: string; days: number } | null>(null)
  const [refund, setRefund] = useState<{ payment: PaymentRow; mode: 'cancel' | 'refund'; amount: string; note: string } | null>(null)
  const [confirmRow, setConfirmRow] = useState<{ kind: 'end' | 'cancel'; row: SubscriptionRow } | null>(null)

  const act = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const res = await fn()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message ?? 'Kaydedildi.')
      after?.()
      router.refresh()
    })

  const name = (id: string) => data.names[id] ?? id.slice(0, 8)
  const filterHref = (source: string | null, status: string | null) => {
    const p = new URLSearchParams()
    if (source) p.set('kaynak', source)
    if (status) p.set('durum', status)
    const q = p.toString()
    return `/admin/billing${q ? `?${q}` : ''}`
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Ödemeler"
        description="Abonelikler, tahsilatlar, iade ve satış ayarları."
        actions={
          <div className="flex flex-wrap gap-2">
            <Chip tone={data.iyzico.configured ? (data.iyzico.mode === 'live' ? 'success' : 'warning') : 'neutral'} dot>
              iyzico: {data.iyzico.configured ? (data.iyzico.mode === 'live' ? 'canlı' : 'sandbox (test)') : 'anahtar yok'}
            </Chip>
            <Chip tone={data.iyzico.webhookSignature ? 'success' : 'neutral'}>Webhook imzası: {data.iyzico.webhookSignature ? 'açık' : 'yok (yeniden okuma)'}</Chip>
            <Chip tone={data.store.apple ? 'success' : 'neutral'}>App Store: {data.store.apple ? 'tanımlı' : 'yok'}</Chip>
            <Chip tone={data.store.google ? 'success' : 'neutral'}>Google Play: {data.store.google ? 'tanımlı' : 'yok'}</Chip>
          </div>
        }
      />

      {!data.ready && (
        <Notice tone="warning" title="Ödeme tabloları canlıda yok">
          supabase/manual/2026-11-23_odeme.sql Supabase SQL Editor&apos;de çalıştırılmalı. O zamana kadar ödeme arayüzü gizli.
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Satış" description="Yasal metinler ve canlı anahtarlar gelmeden açma (docs/PAYMENTS.md)." />
          <CardBody className="grid gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[14px] text-ink">Web satışı (iyzico)</p>
                <p className="text-xs text-ink-faint">Açıkken Spotlight sayfalarında &quot;Abone ol&quot; çalışır.</p>
              </div>
              <Switch
                checked={data.settings.payments_enabled}
                onChange={(v) => setConfirmFlag({ key: 'payments_enabled', value: v })}
                disabled={!data.ready || pending}
                label="Web satışı"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[14px] text-ink">Uygulama içi satın alma</p>
                <p className="text-xs text-ink-faint">Mağaza ürünleri ve doğrulama anahtarları hazır olunca.</p>
              </div>
              <Switch
                checked={data.settings.iap_enabled}
                onChange={(v) => setConfirmFlag({ key: 'iap_enabled', value: v })}
                disabled={!data.ready || pending}
                label="Uygulama içi satın alma"
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="0₺ dönemi"
            description={`Kampanya anahtarı (/admin/tasks): ${data.promoPeriod ? 'açık' : 'kapalı'}. Bitiş = satış başlangıcı; 7 gün önce hatırlatma gider.`}
          />
          <CardBody className="grid gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="0₺ Spotlight bitişi" className="min-w-[220px] flex-1">
                {(p) => <Input {...p} type="datetime-local" value={promoEnds} onChange={(e) => setPromoEnds(e.target.value)} />}
              </Field>
              <Button
                size="sm"
                variant="secondary"
                disabled={!data.ready || pending}
                onClick={() => act(() => setPromoDateAction('promo_ends_at', promoEnds ? new Date(promoEnds).toISOString() : null))}
              >
                Kaydet
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="İlk ay %50 son günü (boş = süresiz)" className="min-w-[220px] flex-1">
                {(p) => <Input {...p} type="datetime-local" value={discountUntil} onChange={(e) => setDiscountUntil(e.target.value)} />}
              </Field>
              <Button
                size="sm"
                variant="secondary"
                disabled={!data.ready || pending}
                onClick={() => act(() => setPromoDateAction('promo_discount_until', discountUntil ? new Date(discountUntil).toISOString() : null))}
              >
                Kaydet
              </Button>
            </div>
            <div>
              <Button size="sm" disabled={!data.ready || pending || !data.promoPeriod || !data.settings.promo_ends_at} onClick={() => act(() => runPromoSweepAction())}>
                0₺ Pro&apos;yu şimdi dağıt
              </Button>
              <p className="mt-1 text-xs text-ink-faint">Saatlik görev de dağıtır (doğrulanmış her influencer / marka, bitiş tarihine kadar Pro).</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Elle Spotlight tanımı" description="Ücretsiz (admin) kayıt; ücretli aboneliği etkilemez. 0 ay = süresiz." />
        <CardBody className="grid gap-3 sm:grid-cols-[1.4fr_1fr_0.6fr_1.4fr_auto] sm:items-end">
          <Field label="Kullanıcı adı, e-posta ya da ID">{(p) => <Input {...p} value={grant.user} onChange={(e) => setGrant({ ...grant, user: e.target.value })} />}</Field>
          <Field label="Paket">
            {(p) => (
              <Select {...p} value={grant.plan} onChange={(e) => setGrant({ ...grant, plan: e.target.value })}>
                <option value="ibasic">Influencer Basic</option>
                <option value="ipro">Influencer Pro</option>
                <option value="mbasic">Marka Basic</option>
                <option value="mpro">Marka Pro</option>
              </Select>
            )}
          </Field>
          <Field label="Ay">{(p) => <Input {...p} type="number" min={0} max={36} value={grant.months} onChange={(e) => setGrant({ ...grant, months: Number(e.target.value) })} />}</Field>
          <Field label="Not">{(p) => <Input {...p} value={grant.note} maxLength={300} onChange={(e) => setGrant({ ...grant, note: e.target.value })} />}</Field>
          <Button disabled={!data.ready || pending || !grant.user.trim()} onClick={() => act(() => grantSpotlightAction(grant), () => setGrant({ ...grant, user: '', note: '' }))}>
            Tanımla
          </Button>
        </CardBody>
      </Card>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Aktif web aboneliği" value={data.counts['iyzico:active'] ?? 0} />
        <StatCard label="Ödeme alınamadı" value={(data.counts['iyzico:past_due'] ?? 0) + (data.counts['apple:past_due'] ?? 0) + (data.counts['google:past_due'] ?? 0)} />
        <StatCard label="Mağaza aboneliği" value={(data.counts['apple:active'] ?? 0) + (data.counts['google:active'] ?? 0)} />
        <StatCard label="0₺ / admin / ödül" value={(data.counts['promo:active'] ?? 0) + (data.counts['admin:active'] ?? 0) + (data.counts['reward:active'] ?? 0)} />
      </div>

      <Card>
        <CardHeader title="Abonelikler" description="Son 200 kayıt." />
        <div className="grid gap-2 px-5 pt-3">
          <Tabs
            label="Kaynak"
            value={data.filters.source ?? 'all'}
            items={[{ value: 'all', label: 'Tümü', href: filterHref(null, data.filters.status) }, ...Object.entries(SOURCE_LABELS).map(([k, v]) => ({ value: k, label: v, href: filterHref(k, data.filters.status) }))]}
          />
          <Tabs
            label="Durum"
            value={data.filters.status ?? 'all'}
            items={[{ value: 'all', label: 'Tümü', href: filterHref(data.filters.source, null) }, ...Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v, href: filterHref(data.filters.source, k) }))]}
          />
        </div>
        {data.subscriptions.length ? (
          <div>
            {data.subscriptions.map((s) => (
              <ListRow key={s.id}>
                <span className="min-w-[130px] text-[13.5px] text-ink">{name(s.user_id)}</span>
                <span className="text-[13px] text-ink-muted">
                  {PLAN_LABELS[s.plan]} ({s.plan}){s.billing_interval ? ` · ${s.billing_interval === 'yr' ? 'yıllık' : 'aylık'}` : ''}
                </span>
                <Chip tone="neutral">{SOURCE_LABELS[s.source as SubscriptionSource]}</Chip>
                <Chip tone={STATUS_TONE[s.status] ?? 'neutral'} dot>
                  {STATUS_LABELS[s.status as SubscriptionStatus]}
                  {s.cancel_at_period_end && s.status === 'active' ? ' · iptal' : ''}
                </Chip>
                {s.discount_percent ? <Chip tone="gold">%{s.discount_percent} {s.discount_state ?? ''}</Chip> : null}
                <span className="flex-1 text-xs text-ink-faint">bitiş {dt(s.current_period_end)}{s.note ? ` · ${s.note}` : ''}</span>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="ghost" leftIcon={<RefreshCcw />} disabled={pending} onClick={() => act(() => reconcileSubscriptionAction(s.id))}>
                    Eşitle
                  </Button>
                  {!isPaidSource(s.source) && s.status === 'active' && (
                    <>
                      <Button size="sm" variant="ghost" disabled={pending || !s.current_period_end} onClick={() => setExtend({ id: s.id, days: 30 })}>
                        Uzat
                      </Button>
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirmRow({ kind: 'end', row: s })}>
                        Bitir
                      </Button>
                    </>
                  )}
                  {s.source === 'iyzico' && ['active', 'past_due'].includes(s.status) && !s.cancel_at_period_end && (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirmRow({ kind: 'cancel', row: s })}>
                      İptal et
                    </Button>
                  )}
                </div>
              </ListRow>
            ))}
          </div>
        ) : (
          <CardBody>
            <EmptyState title="Kayıt yok" />
          </CardBody>
        )}
      </Card>

      <Card>
        <CardHeader title="Başarısız tahsilatlar" description="Son 50." />
        {data.failed.length ? (
          data.failed.map((p) => (
            <ListRow key={p.id}>
              <span className="min-w-[130px] text-[13.5px] text-ink">{name(p.user_id)}</span>
              <span className="text-[13px] text-ink-muted">{formatTry(Number(p.amount))}</span>
              <span className="flex-1 text-xs text-ink-faint">{dt(p.created_at)} · {p.failure_reason ?? 'neden yok'}</span>
            </ListRow>
          ))
        ) : (
          <CardBody>
            <EmptyState title="Başarısız tahsilat yok" />
          </CardBody>
        )}
      </Card>

      <Card>
        <CardHeader title="Tahsilatlar" description="Son 100. Fatura durumu e-Arşiv sağlayıcısı seçilince dolacak." />
        {data.payments.length ? (
          data.payments.map((p) => (
            <ListRow key={p.id}>
              <span className="min-w-[130px] text-[13.5px] text-ink">{name(p.user_id)}</span>
              <span className="text-[13px] text-ink">{Number(p.amount) > 0 ? formatTry(Number(p.amount)) : '—'}</span>
              <Chip tone={PAY_TONE[p.status] ?? 'neutral'}>{p.status}</Chip>
              <Chip tone="neutral">{p.provider}</Chip>
              <span className="flex-1 text-xs text-ink-faint">
                {dt(p.created_at)} · fatura: {p.invoice_status}
                {p.refunded_amount ? ` · iade ${formatTry(Number(p.refunded_amount))}` : ''}
              </span>
              {p.provider === 'iyzico' && ['success', 'partially_refunded'].includes(p.status) && (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => setRefund({ payment: p, mode: 'refund', amount: '', note: '' })}>
                  İade
                </Button>
              )}
            </ListRow>
          ))
        ) : (
          <CardBody>
            <EmptyState title="Tahsilat yok" />
          </CardBody>
        )}
      </Card>

      <Card>
        <CardHeader title="Sağlayıcı bildirimleri" description="Son 30 (yük en aza indirilmiş; kart verisi yok)." />
        {data.events.length ? (
          data.events.map((e) => (
            <ListRow key={e.id}>
              <Chip tone="neutral">{e.provider}</Chip>
              <span className="text-[13px] text-ink">{e.event_type ?? '—'}</span>
              {e.signature_valid === false && <Chip tone="danger">imza geçersiz</Chip>}
              <span className="flex-1 text-xs text-ink-faint">
                {dt(e.received_at)} · {e.result ?? (e.processed_at ? 'işlendi' : 'işlenmedi')}
              </span>
            </ListRow>
          ))
        ) : (
          <CardBody>
            <EmptyState title="Bildirim yok" />
          </CardBody>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirmFlag}
        onClose={() => setConfirmFlag(null)}
        onConfirm={() => confirmFlag && act(() => setBillingFlagAction(confirmFlag.key, confirmFlag.value), () => setConfirmFlag(null))}
        loading={pending}
        tone={confirmFlag?.value ? 'danger' : 'primary'}
        title={confirmFlag?.value ? 'Açılsın mı?' : 'Kapatılsın mı?'}
        description={
          confirmFlag?.value
            ? confirmFlag.key === 'payments_enabled'
              ? `Kullanıcılar kartla abone olabilecek. iyzico şu an ${data.iyzico.mode === 'live' ? 'CANLI' : 'SANDBOX'} modda. Mesafeli satış, ön bilgilendirme ve abonelik metinleri /legal'e yerleşmiş olmalı.`
              : 'Uygulamadan gelen mağaza satın almaları doğrulanıp aboneliğe işlenecek.'
            : 'Yeni satın alma durur; mevcut abonelikler sürer.'
        }
        confirmLabel={confirmFlag?.value ? 'Aç' : 'Kapat'}
      />

      <ConfirmDialog
        open={!!confirmRow}
        onClose={() => setConfirmRow(null)}
        onConfirm={() =>
          confirmRow &&
          act(() => (confirmRow.kind === 'end' ? endFreeSubscriptionAction(confirmRow.row.id) : cancelPaidSubscriptionAction(confirmRow.row.id)), () => setConfirmRow(null))
        }
        loading={pending}
        tone="danger"
        title={confirmRow?.kind === 'end' ? 'Kayıt şimdi bitirilsin mi?' : 'Abonelik iptal edilsin mi?'}
        description={
          confirmRow?.kind === 'end'
            ? 'Bu ücretsiz kayıttan gelen Spotlight hemen kapanır (başka kaydı varsa o sürer).'
            : 'iyzico yeni tahsilat yapmaz; Spotlight dönem sonuna kadar açık kalır. Kullanıcıya bildirim gider.'
        }
        confirmLabel={confirmRow?.kind === 'end' ? 'Bitir' : 'İptal et'}
      />

      <Modal
        open={!!extend}
        onClose={() => setExtend(null)}
        title="Süre uzat"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setExtend(null)}>
              Vazgeç
            </Button>
            <Button size="sm" loading={pending} onClick={() => extend && act(() => extendSubscriptionAction(extend.id, extend.days), () => setExtend(null))}>
              Uzat
            </Button>
          </>
        }
      >
        <Field label="Gün">{(p) => <Input {...p} type="number" min={1} max={366} value={extend?.days ?? 30} onChange={(e) => extend && setExtend({ ...extend, days: Number(e.target.value) })} />}</Field>
      </Modal>

      <Modal
        open={!!refund}
        onClose={() => setRefund(null)}
        title="İade / iptal"
        description={refund ? `${name(refund.payment.user_id)} · ${formatTry(Number(refund.payment.amount))} · ${dt(refund.payment.created_at)}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setRefund(null)}>
              Vazgeç
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={pending}
              disabled={!refund || refund.note.trim().length < 3}
              onClick={() =>
                refund &&
                act(
                  () => refundPaymentAction(refund.payment.id, { mode: refund.mode, amount: refund.amount ? Number(refund.amount.replace(',', '.')) : null, note: refund.note }),
                  () => setRefund(null),
                )
              }
            >
              iyzico&apos;ya gönder
            </Button>
          </>
        }
      >
        {refund && (
          <div className="grid gap-3">
            <Field label="İşlem">
              {(p) => (
                <Select {...p} value={refund.mode} onChange={(e) => setRefund({ ...refund, mode: e.target.value as 'cancel' | 'refund' })}>
                  <option value="refund">İade (tutar girilebilir)</option>
                  <option value="cancel">İptal (aynı gün, tamamı)</option>
                </Select>
              )}
            </Field>
            {refund.mode === 'refund' && (
              <Field label="Tutar (boş = kalan tamamı)">{(p) => <Input {...p} inputMode="decimal" value={refund.amount} onChange={(e) => setRefund({ ...refund, amount: e.target.value })} />}</Field>
            )}
            <Field label="Neden (zorunlu)">{(p) => <Input {...p} value={refund.note} maxLength={500} onChange={(e) => setRefund({ ...refund, note: e.target.value })} />}</Field>
            <Notice tone="warning">Bu işlem iyzico&apos;ya gerçek iade isteği gönderir ve geri alınamaz.</Notice>
          </div>
        )}
      </Modal>
    </div>
  )
}
