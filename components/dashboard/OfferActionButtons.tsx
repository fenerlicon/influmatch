'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { updateOfferStatus } from '@/app/dashboard/influencer/offers/actions'

interface OfferActionButtonsProps {
  offerId: string
  onStatusChange?: (offerId: string, status: 'accepted' | 'rejected' | 'hold', meta?: { roomId?: string | null; senderUserId?: string | null }) => void
}

export default function OfferActionButtons({ offerId, onStatusChange }: OfferActionButtonsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // "Markayla görüş" (hold): teklif beklemede kalır, pazarlık için sohbet açılır (kullanıcı kararı, 2026-10-09).
  const handleAction = (status: 'accepted' | 'rejected' | 'hold') => {
    startTransition(async () => {
      const result = await updateOfferStatus(offerId, status)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      onStatusChange?.(offerId, status, { roomId: result.roomId, senderUserId: result.senderUserId })
      if (status === 'accepted') toast.success('Teklif kabul edildi.')
      if (status === 'rejected') toast.success('Teklif reddedildi.')
      if ((status === 'accepted' || status === 'hold') && result.roomId) {
        router.push(`/dashboard/messages?roomId=${result.roomId}`)
      }
    })
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => handleAction('accepted')}
        className="flex items-center gap-2 rounded-2xl border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 transition hover:border-emerald-300 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        ✅ Kabul Et
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => handleAction('rejected')}
        className="flex items-center gap-2 rounded-2xl border border-red-400/60 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-200 transition hover:border-red-300 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        ✕ Reddet
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => handleAction('hold')}
        className="flex items-center gap-2 rounded-2xl border border-yellow-400/60 bg-yellow-500/10 px-4 py-2 text-xs font-semibold text-yellow-200 transition hover:border-yellow-300 hover:text-yellow-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        💬 Markayla görüş
      </button>
    </div>
  )
}

