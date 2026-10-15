'use client'

import { useState, useTransition } from 'react'
import { saveRateCard } from '@/app/dashboard/influencer/profile/actions'
import { RATE_CARD_ITEMS, type RateCard, type RateCardKey } from '@/lib/rate-card-shared'
import { toast } from 'sonner'
import { Button, Card, CardBody, CardHeader, Field, Input, Switch } from '@/components/ui'

interface Props {
  initial: RateCard | null
}

export default function RateCardForm({ initial }: Props) {
  const [prices, setPrices] = useState<Record<RateCardKey, string>>(() => {
    const result = {} as Record<RateCardKey, string>
    for (const item of RATE_CARD_ITEMS) result[item.key] = initial?.prices[item.key] ? String(initial.prices[item.key]) : ''
    return result
  })
  const [negotiable, setNegotiable] = useState(initial?.negotiable ?? false)
  const [isPending, startTransition] = useTransition()

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    startTransition(async () => {
      const result = await saveRateCard({ prices, negotiable })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(result.rateCard ? 'Fiyat kartın kaydedildi.' : 'Fiyat kartın kaldırıldı.')
    })
  }

  return (
    <Card>
      <form onSubmit={onSubmit}>
      <CardHeader
        title="Fiyat kartı"
        description="Teslimat türü başına başlangıç fiyatın (₺); vermediğin türleri boş bırak. Yalnızca doğrulanmış markalar görür, markalar keşifte bütçeye göre filtreleyebilir."
      />
      <CardBody className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {RATE_CARD_ITEMS.map((item) => (
            <Field key={item.key} label={item.label}>
              {(props) => (
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13.5px] text-ink-faint">₺</span>
                  <Input
                    {...props}
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="Boş"
                    className="pl-7"
                    value={prices[item.key]}
                    onChange={(e) => setPrices((p) => ({ ...p, [item.key]: e.target.value.replace(/[^\d.]/g, '') }))}
                  />
                </div>
              )}
            </Field>
          ))}
        </div>
        <label className="flex items-center justify-between gap-3 text-[13.5px] text-ink">
          Pazarlığa açığım
          <Switch checked={negotiable} onChange={setNegotiable} label="Pazarlığa açığım" />
        </label>
        <div>
          <Button type="submit" variant="primary" loading={isPending}>Fiyat kartını kaydet</Button>
        </div>
      </CardBody>
      </form>
    </Card>
  )
}
