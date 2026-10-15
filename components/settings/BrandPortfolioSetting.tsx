'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Card, Switch } from '@/components/ui'
import { setBrandPortfolioName } from '@/app/actions/portfolio'
import { BRAND_PORTFOLIO_SETTING_HELP, BRAND_PORTFOLIO_SETTING_LABEL } from '@/lib/portfolio-results-shared'

/** Marka tercihi (4.3-S7): influencer portföyündeki sonuçlarda markanın adı görünsün mü. Varsayılan kapalı. */
export default function BrandPortfolioSetting({ initial }: { initial: boolean }) {
  const [value, setValue] = useState(initial)
  const [pending, startTransition] = useTransition()

  const toggle = (next: boolean) => {
    startTransition(async () => {
      const result = await setBrandPortfolioName(next)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setValue(result.showBrandName)
      toast.success('Tercih kaydedildi.')
    })
  }

  return (
    <Card className="flex items-center gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] text-ink">{BRAND_PORTFOLIO_SETTING_LABEL}</p>
        <p className="text-xs text-ink-faint">{BRAND_PORTFOLIO_SETTING_HELP}</p>
      </div>
      <Switch checked={value} onChange={toggle} disabled={pending} label={BRAND_PORTFOLIO_SETTING_LABEL} />
    </Card>
  )
}
