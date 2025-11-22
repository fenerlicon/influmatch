'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { updateOfferStatus } from '@/app/dashboard/influencer/offers/actions'

interface OfferActionButtonsProps {
  offerId: string
  onStatusChange?: (offerId: string, status: 'accepted' | 'rejected', meta?: { roomId?: string | null }) => void
}

export default function OfferActionButtons({ offerId, onStatusChange }: OfferActionButtonsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleAction = (status: 'accepted' | 'rejected') => {
    startTransition(async () => {
      try {
        const result = await updateOfferStatus(offerId, status)
        onStatusChange?.(offerId, status, { roomId: result?.roomId ?? null })
        if (status === 'accepted' && result?.roomId) {
          router.push(`/chat/${result.roomId}`)
        }
      } catch (error) {
        console.error('Offer update failed', error)
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
    </div>
  )
}

