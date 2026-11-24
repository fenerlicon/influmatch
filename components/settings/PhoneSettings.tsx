'use client'

// Ayarlar → Telefon (2026-11-24): zorunlu numara ve isteğe bağlı pazarlama izni. Yalnızca platform görür.

import { useEffect, useState } from 'react'
import { Card, CardBody, CardHeader } from '@/components/ui'
import PhoneForm from '@/components/onboarding/PhoneForm'
import { getOwnPhoneAction } from '@/app/onboarding/actions'

export default function PhoneSettings() {
  const [data, setData] = useState<{ phone: string | null; marketingSms: boolean } | null>(null)
  useEffect(() => {
    getOwnPhoneAction()
      .then(setData)
      .catch(() => setData({ phone: null, marketingSms: false }))
  }, [])

  return (
    <Card className="mb-4">
      <CardHeader title="Telefon" description="Acil durumda sana ulaşabilmemiz için. Numaranı yalnızca Influmatch ekibi görür." />
      <CardBody>
        {data ? (
          <PhoneForm mode="settings" initialPhone={data.phone} initialMarketing={data.marketingSms} />
        ) : (
          <p className="text-[13px] text-ink-muted">Yükleniyor…</p>
        )}
      </CardBody>
    </Card>
  )
}
