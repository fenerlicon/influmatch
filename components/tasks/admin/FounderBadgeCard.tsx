'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Crown } from 'lucide-react'
import { runFounderBadgeSweep, setFounderBadgeCutoff } from '@/app/admin/tasks/actions'
import { founderWindowOpen, isoToIstanbulLocal } from '@/lib/founder-badge-shared'
import { Button, Card, CardBody, CardHeader, Field, Input } from '@/components/ui'

/** Kurucu Üye rozeti son tarihi (0₺ kampanyası başlangıcı) ve elle tarama. Karar 2026-10-26 (SYSTEM_MAP 3.21-N3). */
export default function FounderBadgeCard({ cutoff, holders }: { cutoff: string | null; holders: number | null }) {
  const router = useRouter()
  const [value, setValue] = useState(isoToIstanbulLocal(cutoff))
  const [isPending, startTransition] = useTransition()
  const open = founderWindowOpen(cutoff)

  const run = (fn: () => Promise<{ success: boolean; message?: string; error?: string }>) =>
    startTransition(async () => {
      const result = await fn()
      if (!result.success) {
        toast.error(result.error ?? 'İşlem başarısız.')
        return
      }
      if (result.message) toast.success(result.message)
      router.refresh()
    })

  const status = !cutoff
    ? 'Son tarih belirlenmedi: doğrulanan her hesap rozeti alıyor.'
    : open
      ? `Son tarih ${new Date(cutoff).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}; o ana kadar doğrulanan hesaplar alır.`
      : `Son tarih geçti (${new Date(cutoff).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}); yeni rozet verilmiyor.`

  return (
    <Card className="mb-4">
      <CardHeader
        title="Kurucu Üye rozeti"
        description={holders === null ? status : `${status} Şu an ${holders} hesapta.`}
        action={
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold/10 text-gold">
            <Crown className="h-4 w-4" aria-hidden />
          </span>
        }
      />
      <CardBody className="grid gap-3">
        <p className="text-[13px] text-ink-muted">
          Hesabı bu tarihten önce doğrulanan (onaylanan) her influencer, UGC ve marka hesabı rozeti kalıcı olarak alır. Rozet hesap onayında
          ve saatlik görevde verilir; son tarih geçince yeni rozet verilmez, verilmiş rozetler geri alınmaz. Son tarihi 0₺ kampanyasının
          başlangıcı olarak gir (Türkiye saati). Kampanya başlamadan hemen önce &quot;Şimdi dağıt&quot; ile son onaylananlara da verildiğinden emin ol.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Son tarih (0₺ kampanyası başlangıcı)" className="min-w-[220px] flex-1">
            {(props) => <Input {...props} type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} disabled={isPending} />}
          </Field>
          <Button variant="secondary" size="sm" onClick={() => run(() => setFounderBadgeCutoff(value || null))} disabled={isPending}>
            Kaydet
          </Button>
          {cutoff && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setValue('')
                run(() => setFounderBadgeCutoff(null))
              }}
              disabled={isPending}
            >
              Tarihi kaldır
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => run(() => runFounderBadgeSweep())} disabled={isPending || !open}>
            Şimdi dağıt
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
