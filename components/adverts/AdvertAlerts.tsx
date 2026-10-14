'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { toast } from 'sonner'
import { BellRing, Trash2 } from 'lucide-react'
import { createAdvertAlert, deleteAdvertAlert } from '@/app/dashboard/influencer/advert/actions'
import { ADVERT_ALERT_LIMIT, ADVERT_ALERT_PLATFORMS, describeAlert } from '@/lib/advert-alerts-shared'
import type { AdvertAlert } from '@/lib/advert-alerts'
import { Button, Card, CardBody, CardHeader, EmptyState, Field, Input, ListRow, Select } from '@/components/ui'

const emptyForm = { category: '', platform: '', minBudget: '' }

/** İlan alarmları: yeni açılan ilan alarma uyarsa bildirim (+ e-posta tercihine göre) gelir. */
export default function AdvertAlerts({ alerts, onChange }: { alerts: AdvertAlert[]; onChange: (alerts: AdvertAlert[]) => void }) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const atLimit = alerts.length >= ADVERT_ALERT_LIMIT

  const create = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createAdvertAlert({ category: form.category, platform: form.platform, minBudget: form.minBudget })
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }
      if ('alert' in result && result.alert) onChange([...alerts, result.alert])
      setForm(emptyForm)
      toast.success('Alarm kuruldu. Uygun yeni ilan çıkınca bildirim alacaksın.')
    })
  }

  const remove = (id: string) => {
    startTransition(async () => {
      const result = await deleteAdvertAlert(id)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      onChange(alerts.filter((a) => a.id !== id))
    })
  }

  return (
    <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="overflow-hidden">
        <CardHeader title="Alarmların" description={`${alerts.length} / ${ADVERT_ALERT_LIMIT}`} />
        {alerts.length === 0 ? (
          <EmptyState icon={BellRing} title="Henüz alarm yok" description="Sağdaki formla ilk alarmını kur." />
        ) : (
          alerts.map((alert) => (
            <ListRow key={alert.id}>
              <BellRing className="h-4 w-4 text-ink-faint" aria-hidden />
              <span className="min-w-0 flex-1 text-[13.5px] text-ink">{describeAlert(alert)}</span>
              <Button size="sm" variant="ghost" iconOnly aria-label="Alarmı sil" onClick={() => remove(alert.id)} disabled={isPending}>
                <Trash2 />
              </Button>
            </ListRow>
          ))
        )}
      </Card>

      <Card>
        <CardHeader title="Yeni alarm" description="Boş bıraktığın alan “fark etmez” demektir." />
        <CardBody>
          <form onSubmit={create} className="grid gap-3">
            <Field label="Kategori veya kelime">
              {(p) => <Input {...p} maxLength={60} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Ör. kozmetik" />}
            </Field>
            <Field label="Platform">
              {(p) => (
                <Select {...p} value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}>
                  <option value="">Fark etmez</option>
                  {ADVERT_ALERT_PLATFORMS.map((pl) => (
                    <option key={pl.key} value={pl.key}>
                      {pl.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="En az bütçe (₺)" error={error ?? undefined}>
              {(p) => (
                <Input {...p} type="number" min={1} step={100} value={form.minBudget} onChange={(e) => setForm((f) => ({ ...f, minBudget: e.target.value }))} placeholder="Ör. 5000" />
              )}
            </Field>
            <Button type="submit" variant="primary" loading={isPending} disabled={atLimit}>
              {atLimit ? `En fazla ${ADVERT_ALERT_LIMIT} alarm` : 'Alarm kur'}
            </Button>
            <p className="text-xs text-ink-faint">
              Bildirim site içinde ve mobilde gelir; e-posta, Ayarlar&apos;daki &quot;İlan başvuruları&quot; tercihine göre gider.
            </p>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
