'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateOfferStatus } from '@/app/dashboard/influencer/offers/actions'
import { Button, ConfirmDialog, type ButtonSize } from '@/components/ui'

interface OfferActionButtonsProps {
  offerId: string
  onStatusChange?: (offerId: string, status: 'accepted' | 'rejected' | 'hold', meta?: { roomId?: string | null; senderUserId?: string | null }) => void
  size?: ButtonSize
}

export default function OfferActionButtons({ offerId, onStatusChange, size = 'sm' }: OfferActionButtonsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmReject, setConfirmReject] = useState(false)

  // "Markayla görüş" (hold): teklif beklemede kalır, pazarlık için sohbet açılır (kullanıcı kararı, 2026-10-09).
  const handleAction = (status: 'accepted' | 'rejected' | 'hold') => {
    startTransition(async () => {
      const result = await updateOfferStatus(offerId, status)
      setConfirmReject(false)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      onStatusChange?.(offerId, status, { roomId: result.roomId, senderUserId: result.senderUserId })
      if (status === 'accepted') toast.success('Teklif kabul edildi. İş, İşler sayfasında.')
      if (status === 'rejected') toast.success('Teklif reddedildi.')
      if ((status === 'accepted' || status === 'hold') && result.roomId) {
        router.push(`/dashboard/messages?roomId=${result.roomId}`)
      }
    })
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <Button variant="ghost" size={size} disabled={isPending} onClick={() => setConfirmReject(true)}>
        Reddet
      </Button>
      <Button size={size} disabled={isPending} onClick={() => handleAction('hold')}>
        Markayla görüş
      </Button>
      <Button variant="primary" size={size} loading={isPending} onClick={() => handleAction('accepted')}>
        Kabul et
      </Button>
      <ConfirmDialog
        open={confirmReject}
        onClose={() => setConfirmReject(false)}
        onConfirm={() => handleAction('rejected')}
        title="Teklifi reddet"
        description="Marka bildirim alır. Bu işlem geri alınamaz."
        confirmLabel="Reddet"
        tone="danger"
        loading={isPending}
      />
    </div>
  )
}
