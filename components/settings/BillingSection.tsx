'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CreditCard, Sparkles } from 'lucide-react'
import { Button, ButtonLink, Card, CardBody, CardHeader, Chip, ConfirmDialog, EmptyState, Input, ListRow, Notice, type ChipTone } from '@/components/ui'
import IyzicoForm from '@/components/billing/IyzicoForm'
import { applyCodeAction, cancelSubscriptionAction, changePlanAction, startCardUpdateAction } from '@/app/dashboard/billing/actions'
import {
  PLAN_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  formatTry,
  isUpgrade,
  type BillingRole,
  type SpotlightPlanCode,
  type SubscriptionSource,
  type SubscriptionStatus,
} from '@/lib/payments/billing-shared'

export interface BillingSectionData {
  role: BillingRole | null
  paymentsEnabled: boolean
  entitlement: { plan: SpotlightPlanCode; expiresAt: string | null; source: SubscriptionSource } | null
  subscription: {
    id: string
    plan: SpotlightPlanCode
    interval: 'mo' | 'yr'
    source: SubscriptionSource
    status: SubscriptionStatus
    periodEnd: string | null
    graceUntil: string | null
    cancelAtPeriodEnd: boolean
    pendingPlan: SpotlightPlanCode | null
    discountState: 'scheduled' | 'active' | 'done' | null
    discountPercent: number | null
    discountKind: 'promo_first_period' | 'task_code' | null
  } | null
  otherPlan: SpotlightPlanCode | null
  payments: Array<{
    id: string
    date: string
    amount: number
    currency: string
    status: string
    plan: SpotlightPlanCode | null
    interval: 'mo' | 'yr' | null
    provider: string
    discountPercent: number | null
  }>
  codes: Array<{ code: string; percent: number }>
  cardUpdated: boolean
}

const PAYMENT_STATUS: Record<string, { label: string; tone: ChipTone }> = {
  success: { label: 'Ödendi', tone: 'success' },
  failed: { label: 'Alınamadı', tone: 'danger' },
  refunded: { label: 'İade edildi', tone: 'neutral' },
  partially_refunded: { label: 'Kısmi iade', tone: 'neutral' },
  canceled: { label: 'İptal', tone: 'neutral' },
}

function trDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function BillingSection({ data }: { data: BillingSectionData }) {
  const router = useRouter()
  const sub = data.subscription
  const [confirm, setConfirm] = useState<'cancel' | 'change' | null>(null)
  const [busy, setBusy] = useState(false)
  const [cardForm, setCardForm] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const spotlightHref = data.role === 'brand' ? '/dashboard/spotlight/brand' : '/dashboard/spotlight/influencer'
  const iyzico = sub?.source === 'iyzico'

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(true)
    const res = await fn()
    setBusy(false)
    setConfirm(null)
    if (!res.ok) return toast.error(res.error ?? 'İşlem yapılamadı.')
    toast.success(success)
    router.refresh()
  }

  const openCardForm = async () => {
    if (!sub) return
    setBusy(true)
    const res = await startCardUpdateAction(sub.id)
    setBusy(false)
    if (!res.ok) return toast.error(res.error)
    setCardForm(res.checkoutFormContent)
  }

  const statusTone: ChipTone = sub?.status === 'past_due' ? 'danger' : sub?.cancelAtPeriodEnd ? 'warning' : 'success'
  const discountRunning = sub?.discountState === 'active' || sub?.discountState === 'scheduled'

  return (
    <div className="grid gap-5">
      {data.cardUpdated && <Notice tone="success">Kart bilgin güncellendi.</Notice>}

      <Card>
        <CardHeader
          title="Üyelik"
          description="Spotlight paketin, sonraki ödeme ve iptal."
          action={!sub ? <ButtonLink href={spotlightHref} size="sm" variant="secondary">Spotlight paketleri</ButtonLink> : undefined}
        />
        <CardBody className="grid gap-4">
          {sub ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-semibold text-ink">{PLAN_LABELS[sub.plan]}</span>
                <Chip tone="neutral">{sub.interval === 'yr' ? 'Yıllık' : 'Aylık'}</Chip>
                <Chip tone={statusTone} dot>
                  {sub.cancelAtPeriodEnd && sub.status === 'active' ? 'İptal edildi, dönem sonuna kadar açık' : STATUS_LABELS[sub.status]}
                </Chip>
                <Chip tone="neutral">{SOURCE_LABELS[sub.source]}</Chip>
              </div>
              <dl className="grid gap-2 text-[13.5px] sm:grid-cols-2">
                <div>
                  <dt className="text-ink-faint">{sub.cancelAtPeriodEnd ? 'Bitiş tarihi' : 'Sonraki ödeme'}</dt>
                  <dd className="text-ink">{trDate(sub.periodEnd)}</dd>
                </div>
                {sub.pendingPlan && (
                  <div>
                    <dt className="text-ink-faint">Sonraki dönemde</dt>
                    <dd className="text-ink">{PLAN_LABELS[sub.pendingPlan]}</dd>
                  </div>
                )}
                {discountRunning && sub.discountPercent && (
                  <div>
                    <dt className="text-ink-faint">İndirim</dt>
                    <dd className="text-ink">
                      %{sub.discountPercent} {sub.discountState === 'scheduled' ? '(sonraki ödemede)' : '(bu dönem)'}
                    </dd>
                  </div>
                )}
              </dl>
              {sub.status === 'past_due' && (
                <Notice tone="danger" title="Ödeme alınamadı">
                  {iyzico
                    ? `Kartını ${trDate(sub.graceUntil)} tarihine kadar güncellersen Spotlight kesilmez.`
                    : `${sub.source === 'apple' ? 'App Store' : 'Google Play'} ödeme yöntemini güncelle; Spotlight ${trDate(sub.graceUntil)} tarihine kadar açık.`}
                </Notice>
              )}
              {iyzico ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" leftIcon={<CreditCard />} onClick={openCardForm} loading={busy && !confirm}>
                    Kartı güncelle
                  </Button>
                  {data.otherPlan && sub.status === 'active' && !sub.cancelAtPeriodEnd && !discountRunning && (
                    <Button size="sm" variant="secondary" onClick={() => setConfirm('change')}>
                      {isUpgrade(sub.plan, data.otherPlan) ? `${PLAN_LABELS[data.otherPlan]}'ya geç` : `${PLAN_LABELS[data.otherPlan]}'e geç`}
                    </Button>
                  )}
                  {!sub.cancelAtPeriodEnd && (
                    <Button size="sm" variant="ghost" onClick={() => setConfirm('cancel')}>
                      Aboneliği iptal et
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-[13px] text-ink-muted">
                  Bu abonelik {sub.source === 'apple' ? 'App Store' : 'Google Play'} üzerinden; iptal ve ödeme yöntemi telefonundaki mağaza ayarlarından yönetilir.
                </p>
              )}
              {cardForm && (
                <div className="rounded-xl border border-line p-4">
                  <p className="mb-2 text-[13px] text-ink-muted">Yeni kart bilgilerini iyzico&apos;nun güvenli formuna gir; Influmatch kart bilgini görmez.</p>
                  <IyzicoForm content={cardForm} />
                </div>
              )}
              {iyzico && sub.status === 'active' && !sub.cancelAtPeriodEnd && !discountRunning && !sub.pendingPlan && (
                <div className="grid gap-2 border-t border-line pt-4">
                  <p className="text-[13px] text-ink-muted">
                    İndirim kodunu sonraki ödemene uygula{data.codes.length ? ` (kodların: ${data.codes.map((c) => `${c.code} %${c.percent}`).join(', ')})` : ''}.
                  </p>
                  <div className="flex max-w-md gap-2">
                    <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="IM-XXXXXXXX" maxLength={11} aria-label="İndirim kodu" />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!code.trim()}
                      onClick={() => run(() => applyCodeAction(sub.id, code.trim()), 'Kod sonraki ödemene uygulanacak.')}
                    >
                      Kodu kullan
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : data.entitlement ? (
            <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
              <Sparkles className="h-4 w-4 text-gold" aria-hidden />
              <span className="text-ink">{PLAN_LABELS[data.entitlement.plan]}</span>
              <Chip tone="neutral">{SOURCE_LABELS[data.entitlement.source]}</Chip>
              <span className="text-ink-muted">{data.entitlement.expiresAt ? `${trDate(data.entitlement.expiresAt)} tarihine kadar` : 'süresiz'}</span>
            </div>
          ) : (
            <p className="text-[13.5px] text-ink-muted">Aktif bir Spotlight üyeliğin yok.</p>
          )}
          {!sub && data.codes.length > 0 && (
            <p className="text-[13px] text-ink-muted">
              Kullanılabilir indirim kodların: {data.codes.map((c) => `${c.code} (%${c.percent})`).join(', ')}
              {data.paymentsEnabled ? '' : ' — satış başlayınca kullanılabilir.'}
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Ödeme geçmişi" />
        {data.payments.length ? (
          <div>
            {data.payments.map((p) => (
              <ListRow key={p.id}>
                <span className="min-w-[120px] text-[13px] text-ink-muted">{trDate(p.date)}</span>
                <span className="flex-1 text-[13.5px] text-ink">
                  {p.plan ? PLAN_LABELS[p.plan] : 'Spotlight'} {p.interval === 'yr' ? '· yıllık' : p.interval === 'mo' ? '· aylık' : ''}
                  {p.discountPercent ? ` · %${p.discountPercent} indirim` : ''}
                </span>
                <span className="text-[13.5px] text-ink">{p.amount > 0 ? formatTry(p.amount) : '—'}</span>
                <Chip tone={PAYMENT_STATUS[p.status]?.tone ?? 'neutral'}>{PAYMENT_STATUS[p.status]?.label ?? p.status}</Chip>
              </ListRow>
            ))}
          </div>
        ) : (
          <CardBody>
            <EmptyState title="Henüz ödeme yok" />
          </CardBody>
        )}
      </Card>

      <ConfirmDialog
        open={confirm === 'cancel'}
        onClose={() => setConfirm(null)}
        onConfirm={() => sub && run(() => cancelSubscriptionAction(sub.id), 'Aboneliğin iptal edildi.')}
        loading={busy}
        tone="danger"
        title="Abonelik iptal edilsin mi?"
        description={
          sub?.status === 'past_due'
            ? 'Spotlight üyeliğin hemen sona erer.'
            : `Yeni ödeme alınmaz. Spotlight ${trDate(sub?.periodEnd)} tarihine kadar açık kalır.`
        }
        confirmLabel="Aboneliği iptal et"
      />
      <ConfirmDialog
        open={confirm === 'change'}
        onClose={() => setConfirm(null)}
        onConfirm={() => sub && data.otherPlan && run(() => changePlanAction(sub.id, data.otherPlan!), 'Paket değişikliği kaydedildi.')}
        loading={busy}
        title={data.otherPlan ? `${PLAN_LABELS[data.otherPlan]} paketine geçilsin mi?` : ''}
        description={
          sub && data.otherPlan && isUpgrade(sub.plan, data.otherPlan)
            ? 'Yükseltme hemen geçerli olur.'
            : 'Değişiklik bir sonraki ödeme döneminde geçerli olur.'
        }
        confirmLabel="Paketi değiştir"
      />
    </div>
  )
}
