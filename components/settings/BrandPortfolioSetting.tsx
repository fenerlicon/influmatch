'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { setBrandPortfolioName } from '@/app/actions/portfolio'
import { BRAND_PORTFOLIO_SETTING_HELP, BRAND_PORTFOLIO_SETTING_LABEL } from '@/lib/portfolio-results-shared'

/** Marka tercihi (4.3-S7): influencer portföyündeki sonuçlarda markanın adı görünsün mü. Varsayılan kapalı. */
export default function BrandPortfolioSetting({ initial }: { initial: boolean }) {
  const [value, setValue] = useState(initial)
  const [pending, startTransition] = useTransition()

  const toggle = () => {
    const next = !value
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
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Portföylerde marka adı</h2>
          <p className="mt-1 text-sm text-gray-300">{BRAND_PORTFOLIO_SETTING_LABEL}</p>
          <p className="mt-1 text-xs text-gray-500">{BRAND_PORTFOLIO_SETTING_HELP}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={value}
          aria-label={BRAND_PORTFOLIO_SETTING_LABEL}
          disabled={pending}
          onClick={toggle}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition disabled:opacity-60 ${value ? 'bg-soft-gold' : 'bg-white/15'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${value ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
    </section>
  )
}
