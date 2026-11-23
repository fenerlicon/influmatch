'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Lock } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, Chip, Field, Input, Notice } from '@/components/ui'
import IyzicoForm from '@/components/billing/IyzicoForm'
import { previewCheckoutAction, startCheckoutAction } from '@/app/dashboard/billing/actions'
import { PLAN_LABELS, formatTry, type BillingInterval, type PriceQuote, type SpotlightPlanCode } from '@/lib/payments/billing-shared'

interface CheckoutFormProps {
  plan: SpotlightPlanCode
  interval: BillingInterval
  initialQuote: PriceQuote
  defaultName: string
  sandbox: boolean
}

// Yasal metinler avukattan gelecek; bağlantılar app/legal/page.tsx sekmelerine gider.
const LEGAL_LINKS = [
  { tab: 'distance-sales', label: 'Mesafeli Satış Sözleşmesi' },
  { tab: 'pre-information', label: 'Ön Bilgilendirme Formu' },
  { tab: 'subscription-terms', label: 'Abonelik, otomatik yenileme ve iptal koşulları' },
] as const

function splitName(full: string) {
  const parts = full.trim().split(/\s+/)
  if (parts.length < 2) return { name: parts[0] ?? '', surname: '' }
  return { name: parts.slice(0, -1).join(' '), surname: parts[parts.length - 1] }
}

export default function CheckoutForm({ plan, interval, initialQuote, defaultName, sandbox }: CheckoutFormProps) {
  const initialName = splitName(defaultName)
  const [quote, setQuote] = useState(initialQuote)
  const [code, setCode] = useState('')
  const [appliedCode, setAppliedCode] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [checkingCode, setCheckingCode] = useState(false)
  const [name, setName] = useState(initialName.name)
  const [surname, setSurname] = useState(initialName.surname)
  const [gsm, setGsm] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [identityNumber, setIdentityNumber] = useState('')
  const [accepted, setAccepted] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formContent, setFormContent] = useState<string | null>(null)

  const allAccepted = LEGAL_LINKS.every((l) => accepted[l.tab])

  const applyCode = async () => {
    const value = code.trim().toUpperCase()
    setCheckingCode(true)
    setCodeError(null)
    const res = await previewCheckoutAction(plan, interval, value || null)
    setCheckingCode(false)
    if (!res.ok) return setCodeError(res.error)
    setQuote(res.quote)
    if (res.codeError) {
      setCodeError(res.codeError)
      setAppliedCode(null)
    } else setAppliedCode(value || null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!allAccepted) return toast.error('Devam etmek için sözleşmeleri onaylaman gerekiyor.')
    setSubmitting(true)
    const res = await startCheckoutAction({
      plan,
      interval,
      code: appliedCode,
      customer: { name, surname, gsm, city, address, identityNumber: identityNumber || null },
      acceptedTerms: allAccepted,
    })
    setSubmitting(false)
    if (!res.ok) return toast.error(res.error)
    setFormContent(res.checkoutFormContent)
  }

  const summary = (
    <Card>
      <CardHeader title="Özet" />
      <CardBody className="grid gap-3 text-[13.5px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-ink">{PLAN_LABELS[plan]}</span>
          <Chip tone="gold">{interval === 'yr' ? 'Yıllık' : 'Aylık'}</Chip>
        </div>
        <div className="flex items-center justify-between text-ink-muted">
          <span>Paket fiyatı</span>
          <span>{formatTry(quote.baseAmount)}</span>
        </div>
        {quote.discountPercent ? (
          <div className="flex items-center justify-between text-success">
            <span>{quote.discountKind === 'promo_first_period' ? `İlk ay %${quote.discountPercent} indirim` : `İndirim kodu %${quote.discountPercent}`}</span>
            <span>−{formatTry(quote.baseAmount - quote.amount)}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between border-t border-line pt-3 font-semibold text-ink">
          <span>{interval === 'yr' ? 'İlk yıl' : 'İlk ay'}</span>
          <span>{formatTry(quote.amount)}</span>
        </div>
        <p className="text-xs text-ink-faint">
          Sonraki her {interval === 'yr' ? 'yıl' : 'ay'} {formatTry(quote.baseAmount)} kartından otomatik tahsil edilir; istediğin zaman Ayarlar &gt; Üyelik ve
          ödemeler&apos;den iptal edebilirsin.
        </p>
        {quote.codeDeferred && (
          <Notice tone="info">İlk ay indirimi koddan büyük olduğu için ilk ayda o geçerli. Kodun saklı kalır; sonraki bir yenilemede kullanabilirsin.</Notice>
        )}
      </CardBody>
    </Card>
  )

  if (formContent) {
    return (
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card padded>
          <p className="mb-3 flex items-center gap-2 text-[13px] text-ink-muted">
            <Lock className="h-4 w-4 text-gold" aria-hidden /> Kart bilgileri iyzico&apos;nun güvenli formunda girilir; Influmatch kart bilgini görmez ve saklamaz.
          </p>
          <IyzicoForm content={formContent} />
        </Card>
        {summary}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="grid content-start gap-5">
        {sandbox && <Notice tone="warning">Test ortamı (iyzico sandbox): gerçek tahsilat yapılmaz, yalnızca iyzico test kartları çalışır.</Notice>}
        <Card>
          <CardHeader title="Fatura bilgileri" description="iyzico ödeme ve fatura için ister." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Ad">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required autoComplete="given-name" />}</Field>
            <Field label="Soyad">{(p) => <Input {...p} value={surname} onChange={(e) => setSurname(e.target.value)} maxLength={50} required autoComplete="family-name" />}</Field>
            <Field label="Cep telefonu" hint="05xx xxx xx xx">
              {(p) => <Input {...p} value={gsm} onChange={(e) => setGsm(e.target.value)} inputMode="tel" maxLength={20} required autoComplete="tel" />}
            </Field>
            <Field label="Şehir">{(p) => <Input {...p} value={city} onChange={(e) => setCity(e.target.value)} maxLength={50} required autoComplete="address-level1" />}</Field>
            <Field label="Fatura adresi" className="sm:col-span-2">
              {(p) => <Input {...p} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} required autoComplete="street-address" />}
            </Field>
            <Field label="T.C. kimlik numarası (isteğe bağlı)" hint="Fatura için gerekebilir." className="sm:col-span-2">
              {(p) => <Input {...p} value={identityNumber} onChange={(e) => setIdentityNumber(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={11} />}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="İndirim kodu" description="Görev ödülü kodun varsa (IM-XXXXXXXX)." />
          <CardBody className="grid gap-2">
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="IM-XXXXXXXX" maxLength={11} aria-label="İndirim kodu" />
              <Button type="button" variant="secondary" onClick={applyCode} loading={checkingCode}>
                Uygula
              </Button>
            </div>
            {codeError && <p className="text-xs text-danger">{codeError}</p>}
            {appliedCode && !codeError && <p className="text-xs text-success">Kod uygulandı.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Onaylar" />
          <CardBody className="grid gap-3 text-[13.5px]">
            {LEGAL_LINKS.map((l) => (
              <label key={l.tab} className="flex items-start gap-2.5 text-ink-muted">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-gold"
                  checked={!!accepted[l.tab]}
                  onChange={(e) => setAccepted((prev) => ({ ...prev, [l.tab]: e.target.checked }))}
                  required
                />
                <span>
                  <Link href={`/legal?tab=${l.tab}`} target="_blank" className="text-gold hover:underline">
                    {l.label}
                  </Link>
                  {' '}— okudum, onaylıyorum.
                </span>
              </label>
            ))}
          </CardBody>
        </Card>
      </div>
      <div className="grid content-start gap-4">
        {summary}
        <Button type="submit" variant="primary" block loading={submitting} disabled={!allAccepted}>
          Ödemeye geç
        </Button>
      </div>
    </form>
  )
}
