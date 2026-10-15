'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { setCampaignStatus } from '@/app/dashboard/brand/campaigns/actions'
import { Select } from '@/components/ui'
import { CAMPAIGN_STATUSES, CAMPAIGN_STATUS_LABELS, type CampaignStatus } from '@/lib/campaigns-shared'

/** Kampanya durumu: taslak / aktif / tamamlandı / arşiv. */
export default function CampaignStatusControl({ campaignId, status }: { campaignId: string; status: CampaignStatus }) {
  const router = useRouter()
  const [value, setValue] = useState(status)
  const [pending, startTransition] = useTransition()

  const change = (next: CampaignStatus) => {
    const previous = value
    setValue(next)
    startTransition(async () => {
      const result = await setCampaignStatus(campaignId, next)
      if ('error' in result && result.error) {
        setValue(previous)
        toast.error(result.error)
        return
      }
      toast.success(`Durum: ${CAMPAIGN_STATUS_LABELS[next]}`)
      router.refresh()
    })
  }

  return (
    <Select aria-label="Kampanya durumu" value={value} disabled={pending} onChange={(e) => change(e.target.value as CampaignStatus)} className="w-auto">
      {CAMPAIGN_STATUSES.map((s) => (
        <option key={s} value={s}>
          {CAMPAIGN_STATUS_LABELS[s]}
        </option>
      ))}
    </Select>
  )
}
