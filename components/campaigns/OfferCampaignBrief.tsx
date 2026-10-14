'use client'

import { useEffect, useState } from 'react'
import { getOfferCampaignBrief } from '@/app/actions/campaign-brief'
import type { CampaignBrief } from '@/lib/campaigns-shared'
import CampaignBriefView from './CampaignBriefView'

/** Teklif ayrıntısında kampanya brief'i (3.19); sunucudan, teklifin tarafı olarak yüklenir. */
export default function OfferCampaignBrief({ offerId }: { offerId: string }) {
  const [state, setState] = useState<{ loading: boolean; brief: CampaignBrief | null; error: string | null }>({ loading: true, brief: null, error: null })

  useEffect(() => {
    let cancelled = false
    getOfferCampaignBrief(offerId)
      .then((result) => {
        if (cancelled) return
        setState('error' in result ? { loading: false, brief: null, error: result.error } : { loading: false, brief: result.brief, error: null })
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, brief: null, error: 'Brief yüklenemedi.' })
      })
    return () => {
      cancelled = true
    }
  }, [offerId])

  if (state.loading) return <p className="text-[13px] text-ink-faint">Kampanya brief’i yükleniyor…</p>
  if (state.error) return <p className="text-[13px] text-danger">{state.error}</p>
  if (!state.brief) return null
  return <CampaignBriefView brief={state.brief} />
}
