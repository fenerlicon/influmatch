'use client'

// Barter teslimat adresi (2026-11-24). Influencer girer / günceller; marka yalnızca anlaşma özeti iki tarafça onaylandıktan
// sonra görür (sunucu kuralı: lib/collaboration-shipping.ts).

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, CardBody, CardHeader, Field, Input, Notice, Textarea } from '@/components/ui'
import { saveShippingAction } from '@/app/dashboard/collaborations/[id]/actions'
import { SHIPPING_BRAND_LOCKED_NOTE, SHIPPING_INFLUENCER_NOTE, SHIPPING_LIMITS, type ShippingAddress, type ShippingView } from '@/lib/collaboration-shipping-shared'
import { formatPhone } from '@/lib/phone-shared'

const EMPTY: ShippingAddress = { recipient_name: '', phone: '', address_line: '', district: '', city: '', postal_code: null, note: null }

function AddressText({ a }: { a: ShippingAddress }) {
  return (
    <div className="grid gap-0.5 text-[13.5px]">
      <p className="font-medium text-ink">{a.recipient_name}</p>
      <p className="text-ink-muted">{a.address_line}</p>
      <p className="text-ink-muted">
        {a.district} / {a.city}
        {a.postal_code ? ` · ${a.postal_code}` : ''}
      </p>
      <p className="text-ink-muted">{formatPhone(a.phone)}</p>
      {a.note && <p className="text-xs text-ink-faint">Not: {a.note}</p>}
    </div>
  )
}

export default function ShippingCard({ collaborationId, shipping, isBrand }: { collaborationId: string; shipping: ShippingView; isBrand: boolean }) {
  const router = useRouter()
  const saved = !isBrand && shipping.address && !shipping.suggested ? shipping.address : null
  const [editing, setEditing] = useState(!isBrand && !saved)
  const [form, setForm] = useState<ShippingAddress>({ ...EMPTY, ...(shipping.address ?? {}), phone: shipping.address ? formatPhone(shipping.address.phone) : '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof ShippingAddress) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value })

  const save = async () => {
    setError(null)
    setBusy(true)
    const result = await saveShippingAction(collaborationId, { ...form }).catch(() => ({ error: 'Bağlantı hatası.' }))
    setBusy(false)
    if (!('success' in result) || !result.success) return setError(('error' in result && result.error) || 'Kaydedilemedi.')
    toast.success(result.message)
    setEditing(false)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader title="Teslimat adresi" description={isBrand ? 'Barter iş birliği: ürünün gönderileceği adres.' : SHIPPING_INFLUENCER_NOTE} />
      <CardBody className="grid gap-3">
        {isBrand ? (
          shipping.lockedForBrand ? (
            <Notice tone="info">{SHIPPING_BRAND_LOCKED_NOTE}</Notice>
          ) : shipping.address ? (
            <AddressText a={shipping.address} />
          ) : (
            <p className="text-[13px] text-ink-muted">Influencer henüz teslimat adresini eklemedi.</p>
          )
        ) : editing && shipping.canEdit ? (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
          >
            {shipping.suggested && <p className="text-xs text-ink-faint">Önceki iş birliğindeki adresin dolduruldu; kontrol edip kaydet.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Alıcı adı soyadı">
                {(p) => <Input {...p} required maxLength={SHIPPING_LIMITS.recipientMax} autoComplete="name" value={form.recipient_name} onChange={set('recipient_name')} />}
              </Field>
              <Field label="Telefon">
                {(p) => <Input {...p} required type="tel" inputMode="tel" autoComplete="tel" placeholder="0532 123 45 67" value={form.phone} onChange={set('phone')} />}
              </Field>
            </div>
            <Field label="Açık adres">
              {(p) => (
                <Textarea {...p} rows={2} required maxLength={SHIPPING_LIMITS.addressMax} autoComplete="street-address" placeholder="Mahalle, cadde / sokak, no, daire" value={form.address_line} onChange={set('address_line')} />
              )}
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="İlçe">{(p) => <Input {...p} required maxLength={SHIPPING_LIMITS.districtMax} value={form.district} onChange={set('district')} />}</Field>
              <Field label="İl">{(p) => <Input {...p} required maxLength={SHIPPING_LIMITS.cityMax} autoComplete="address-level1" value={form.city} onChange={set('city')} />}</Field>
              <Field label="Posta kodu" hint="İsteğe bağlı">
                {(p) => <Input {...p} inputMode="numeric" maxLength={5} autoComplete="postal-code" value={form.postal_code ?? ''} onChange={set('postal_code')} />}
              </Field>
            </div>
            <Field label="Not" hint="İsteğe bağlı (ör. kapıcıya bırakılabilir)">
              {(p) => <Input {...p} maxLength={SHIPPING_LIMITS.noteMax} value={form.note ?? ''} onChange={set('note')} />}
            </Field>
            {error && <Notice tone="danger">{error}</Notice>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" variant="primary" loading={busy} leftIcon={<MapPin />}>
                Adresi kaydet
              </Button>
              {saved && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Vazgeç
                </Button>
              )}
            </div>
          </form>
        ) : saved ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <AddressText a={saved} />
            {shipping.canEdit && (
              <Button size="sm" variant="ghost" leftIcon={<Pencil />} onClick={() => setEditing(true)}>
                Düzenle
              </Button>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-ink-muted">Adres eklenmedi.</p>
        )}
      </CardBody>
    </Card>
  )
}
