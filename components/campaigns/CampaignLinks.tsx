'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Link2, Unlink } from 'lucide-react'
import { getAttachables, linkToCampaign } from '@/app/dashboard/brand/campaigns/actions'
import { Button, Card, CardBody, CardHeader, Chip, Select } from '@/components/ui'
import { CAMPAIGN_OFFER_STATUS_LABELS, type CampaignOfferStatus } from '@/lib/campaigns-shared'

interface Props {
  campaignId: string
  adverts: Array<{ id: string; title: string; status: string | null }>
  /** Taslak / aktif kampanyada yeni bağlantı eklenebilir. */
  canAttach: boolean
}

type Attachables = {
  offers: Array<{ id: string; campaign_name: string | null; status: string; receiver_name: string | null }>
  adverts: Array<{ id: string; title: string; status: string | null }>
}

/** Mevcut teklifleri ve ilanları kampanyaya bağlama (bağlı ilandan kabul edilen başvurular da kampanyada görünür). */
export default function CampaignLinks({ campaignId, adverts, canAttach }: Props) {
  const router = useRouter()
  const [data, setData] = useState<Attachables | null>(null)
  const [offerId, setOfferId] = useState('')
  const [advertId, setAdvertId] = useState('')
  const [pending, startTransition] = useTransition()

  const load = () =>
    startTransition(async () => {
      const result = await getAttachables()
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      if ('offers' in result) setData({ offers: result.offers, adverts: result.adverts })
    })

  const link = (kind: 'offer' | 'advert', id: string, attach: boolean) =>
    startTransition(async () => {
      const result = await linkToCampaign(campaignId, { kind, id, attach })
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success(attach ? 'Kampanyaya eklendi.' : 'Kampanyadan çıkarıldı.')
      setOfferId('')
      setAdvertId('')
      setData(null)
      router.refresh()
    })

  return (
    <Card>
      <CardHeader title="Bağlı ilanlar ve mevcut teklifler" description="Bağlı ilandan kabul ettiğin başvurular kampanya tablosunda görünür." />
      <CardBody className="grid gap-4">
        {adverts.length > 0 ? (
          <ul className="grid gap-2">
            {adverts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 text-[13.5px]">
                <span className="min-w-0 flex-1 truncate text-ink">{a.title}</span>
                {a.status && <Chip>{a.status === 'open' ? 'Açık' : a.status === 'paused' ? 'Duraklatıldı' : 'Kapalı'}</Chip>}
                <Button size="sm" variant="ghost" leftIcon={<Unlink />} disabled={pending} onClick={() => link('advert', a.id, false)}>
                  Çıkar
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-faint">Bağlı ilan yok.</p>
        )}

        {canAttach &&
          (data === null ? (
            <div>
              <Button size="sm" leftIcon={<Link2 />} loading={pending} onClick={load}>
                Teklif ya da ilan bağla
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <div className="text-[12.5px] font-medium text-ink-muted">Mevcut teklif</div>
                <div className="flex gap-2">
                  <Select aria-label="Teklif seç" value={offerId} onChange={(e) => setOfferId(e.target.value)} className="min-w-0 flex-1">
                    <option value="">{data.offers.length ? 'Teklif seç' : 'Bağlanabilecek teklif yok'}</option>
                    {data.offers.map((o) => (
                      <option key={o.id} value={o.id}>
                        {(o.receiver_name ?? 'Profil') + ' · ' + (o.campaign_name ?? 'Teklif') + ' · ' + (CAMPAIGN_OFFER_STATUS_LABELS[o.status as CampaignOfferStatus] ?? o.status)}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" disabled={!offerId || pending} onClick={() => link('offer', offerId, true)}>
                    Bağla
                  </Button>
                </div>
              </div>
              <div className="grid gap-1.5">
                <div className="text-[12.5px] font-medium text-ink-muted">İlan</div>
                <div className="flex gap-2">
                  <Select aria-label="İlan seç" value={advertId} onChange={(e) => setAdvertId(e.target.value)} className="min-w-0 flex-1">
                    <option value="">{data.adverts.length ? 'İlan seç' : 'Bağlanabilecek ilan yok'}</option>
                    {data.adverts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" disabled={!advertId || pending} onClick={() => link('advert', advertId, true)}>
                    Bağla
                  </Button>
                </div>
              </div>
            </div>
          ))}
      </CardBody>
    </Card>
  )
}

/** Tablo satırındaki "kampanyadan çıkar" (yalnızca teklif satırı). */
export function DetachOfferButton({ campaignId, offerId }: { campaignId: string; offerId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Button
      size="sm"
      variant="ghost"
      iconOnly
      aria-label="Kampanyadan çıkar"
      title="Kampanyadan çıkar (teklif silinmez)"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await linkToCampaign(campaignId, { kind: 'offer', id: offerId, attach: false })
          if ('error' in result && result.error) toast.error(result.error)
          else router.refresh()
        })
      }
    >
      <Unlink />
    </Button>
  )
}
