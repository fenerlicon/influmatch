'use client'

// Admin kullanıcı ayrıntısı: telefon numarası (2026-11-24). Varsayılan gizli; "Telefonu göster" her basışta günlüğe yazılır.

import { useState } from 'react'
import { Phone } from 'lucide-react'
import { Button, Chip } from '@/components/ui'
import { getUserPhone } from '@/app/admin/contact-actions'
import { formatPhone } from '@/lib/phone-shared'

export default function UserPhone({ userId }: { userId: string }) {
  const [data, setData] = useState<{ phone: string | null; marketingSms: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const show = async () => {
    setLoading(true)
    setError(null)
    const result = await getUserPhone(userId).catch(() => ({ error: 'Bağlantı hatası.' }))
    setLoading(false)
    if ('error' in result) setError(result.error)
    else setData(result)
  }

  if (!data) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={show} loading={loading} leftIcon={<Phone />}>
          Telefonu göster
        </Button>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      <Phone className="h-4 w-4 text-ink-muted" aria-hidden />
      {data.phone ? (
        <a href={`tel:${data.phone}`} className="text-ink hover:text-gold">
          {formatPhone(data.phone)}
        </a>
      ) : (
        <span className="text-ink-faint">Numara girilmemiş</span>
      )}
      <Chip tone={data.marketingSms ? 'success' : 'neutral'}>{data.marketingSms ? 'Pazarlama izni var' : 'Pazarlama izni yok'}</Chip>
    </div>
  )
}
