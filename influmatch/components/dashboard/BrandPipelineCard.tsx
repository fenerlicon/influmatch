'use client'

import { useState, useEffect } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'

interface BrandPipelineCardProps {
  userId: string
  initialPendingCount?: number
  initialAcceptedCount?: number
}

export default function BrandPipelineCard({
  userId,
  initialPendingCount = 0,
  initialAcceptedCount = 0,
}: BrandPipelineCardProps) {
  const supabase = useSupabaseClient()
  const [pendingCount, setPendingCount] = useState(initialPendingCount)
  const [acceptedCount, setAcceptedCount] = useState(initialAcceptedCount)

  // Fetch initial counts
  useEffect(() => {
    const fetchCounts = async () => {
      const { data: offerStatuses } = await supabase
        .from('offers')
        .select('status')
        .eq('sender_user_id', userId)

      if (offerStatuses) {
        const pending = offerStatuses.filter((row) => row.status === 'pending').length
        const accepted = offerStatuses.filter((row) => row.status === 'accepted').length
        setPendingCount(pending)
        setAcceptedCount(accepted)
      }
    }

    fetchCounts()
  }, [userId, supabase])

  // Real-time subscription for offers
  useEffect(() => {
    const channel = supabase
      .channel(`brand-pipeline-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'offers',
          filter: `sender_user_id=eq.${userId}`,
        },
        async () => {
          // Refetch counts when offers change
          const { data: offerStatuses } = await supabase
            .from('offers')
            .select('status')
            .eq('sender_user_id', userId)

          if (offerStatuses) {
            const pending = offerStatuses.filter((row) => row.status === 'pending').length
            const accepted = offerStatuses.filter((row) => row.status === 'accepted').length
            setPendingCount(pending)
            setAcceptedCount(accepted)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase])

  const pipeline = [
    { label: 'Keşif', count: 'yakında', description: 'Filtrelenmiş uygun profiller', isComingSoon: true },
    { label: 'Teklif Gönderildi', count: pendingCount, description: 'Onay bekleyen iş birlikleri', isComingSoon: false },
    { label: 'Üretim', count: acceptedCount, description: 'İçerik üretimi devam ediyor', isComingSoon: false },
  ]

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Pipeline</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Kampanya Akışı</h2>
        </div>
        <span className="rounded-full border border-white/10 px-4 py-1 text-xs text-gray-300">
          Güncel durum
        </span>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {pipeline.map((item) => (
          <div
            key={item.label}
            className={`rounded-2xl border p-4 ${
              item.isComingSoon
                ? 'border-white/5 bg-[#0A0B0F] text-gray-400 opacity-60'
                : 'border-white/5 bg-[#11121A] text-gray-300'
            }`}
          >
            <p
              className={`text-xs uppercase tracking-[0.3em] ${
                item.isComingSoon ? 'text-gray-500' : 'text-soft-gold'
              }`}
            >
              {item.label}
            </p>
            <p
              className={`mt-3 text-3xl font-semibold ${
                item.isComingSoon ? 'text-gray-500' : 'text-white'
              }`}
            >
              {item.count}
            </p>
            <p className={`mt-2 text-sm ${item.isComingSoon ? 'text-gray-500' : ''}`}>
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

