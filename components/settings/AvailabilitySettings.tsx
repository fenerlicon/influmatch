'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button, Card, CardBody, CardHeader, Field, Input, Segmented } from '@/components/ui'
import { updateAvailability } from '@/app/dashboard/influencer/settings/actions'
import { AVAILABILITY_NOTE_MAX, availabilityText, istanbulToday, type Availability } from '@/lib/availability-shared'

/**
 * "İş alıyorum / Şu an dolu" (3.19). Doluyken keşifte alt sırada görünürsün ve teklif penceresi markayı uyarır
 * (teklif yine gönderilebilir). Bitiş tarihi geçince durum kendiliğinden "İş alıyorum"a döner.
 */
export default function AvailabilitySettings({ initial }: { initial: Availability }) {
  const [saved, setSaved] = useState(initial)
  const [status, setStatus] = useState(initial.status)
  const [note, setNote] = useState(initial.note ?? '')
  const [until, setUntil] = useState(initial.until ?? '')
  const [pending, startTransition] = useTransition()

  const save = (next: { status: 'open' | 'busy'; note?: string; until?: string }) => {
    startTransition(async () => {
      const result = await updateAvailability({ status: next.status, note: next.note ?? null, until: next.until || null })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setSaved(result.availability)
      toast.success('Müsaitlik kaydedildi.')
    })
  }

  const choose = (next: 'open' | 'busy') => {
    setStatus(next)
    if (next === 'open') save({ status: 'open' })
  }

  return (
    <Card>
      <CardHeader
        title="Müsaitlik"
        description={'Markalar keşifte ve profilinde durumunu görür. "Şu an dolu" iken keşifte alt sırada görünürsün; markalar yine teklif gönderebilir.'}
      />
      <CardBody className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="Müsaitlik durumu"
            value={status}
            onSelect={(v) => !pending && choose(v as 'open' | 'busy')}
            items={[
              { value: 'open', label: 'İş alıyorum' },
              { value: 'busy', label: 'Şu an dolu' },
            ]}
          />
          <span className="text-xs text-ink-faint">Şu anki durum: {availabilityText(saved)}</span>
        </div>

        {status === 'busy' && (
          <form
            className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault()
              save({ status: 'busy', note, until })
            }}
          >
            <Field label="Not (isteğe bağlı)">
              {(props) => (
                <Input
                  {...props}
                  value={note}
                  maxLength={AVAILABILITY_NOTE_MAX}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ör. Ay sonuna kadar takvimim dolu"
                />
              )}
            </Field>
            <Field label="Bitiş (isteğe bağlı)">
              {(props) => <Input {...props} type="date" value={until} min={istanbulToday()} onChange={(e) => setUntil(e.target.value)} />}
            </Field>
            <Button type="submit" variant="primary" loading={pending}>Kaydet</Button>
          </form>
        )}
      </CardBody>
    </Card>
  )
}
