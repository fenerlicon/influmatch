'use client'

// Telefon numarası formu (panel kapısı /onboarding/phone ve Ayarlar). Yalnızca platform görür (lib/user-contact.ts).

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Button, Card, CardBody, Field, Input, Notice } from '@/components/ui'
import { savePhoneAction } from '@/app/onboarding/actions'
import { MARKETING_SMS_LABEL, PHONE_PURPOSE_NOTE, formatPhone, normalizePhone } from '@/lib/phone-shared'

export default function PhoneForm({
  initialPhone = null,
  initialMarketing = false,
  mode = 'gate',
}: {
  initialPhone?: string | null
  initialMarketing?: boolean
  /** gate: kaydedince panele geçer; settings: yerinde kalır. */
  mode?: 'gate' | 'settings'
}) {
  const router = useRouter()
  const [phone, setPhone] = useState(formatPhone(initialPhone))
  const [marketing, setMarketing] = useState(initialMarketing)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null)

  const save = async () => {
    setMessage(null)
    const checked = normalizePhone(phone)
    if ('error' in checked) return setMessage({ tone: 'danger', text: checked.error })
    setSaving(true)
    const result = await savePhoneAction({ phone: checked.phone, marketingSms: marketing }).catch(() => ({ success: false as const, error: 'Bağlantı hatası.' }))
    setSaving(false)
    if (!result.success) return setMessage({ tone: 'danger', text: result.error })
    if (mode === 'gate') {
      router.replace('/dashboard')
      router.refresh()
    } else {
      setPhone(formatPhone(checked.phone))
      setMessage({ tone: 'success', text: 'Kaydedildi.' })
    }
  }

  const body = (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <Field label="Telefon numarası" hint={PHONE_PURPOSE_NOTE}>
        {(props) => (
          <Input {...props} type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0532 123 45 67" />
        )}
      </Field>
      <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-ink-muted">
        <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 h-4 w-4 flex-none accent-gold" />
        <span>{MARKETING_SMS_LABEL}</span>
      </label>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div className={mode === 'gate' ? 'flex justify-end border-t border-line pt-5' : ''}>
        <Button type="submit" variant="primary" size={mode === 'gate' ? 'lg' : 'sm'} loading={saving} rightIcon={mode === 'gate' ? <ArrowRight /> : undefined}>
          {mode === 'gate' ? 'Kaydet ve devam et' : 'Kaydet'}
        </Button>
      </div>
    </form>
  )

  return mode === 'gate' ? (
    <Card>
      <CardBody>{body}</CardBody>
    </Card>
  ) : (
    body
  )
}
