'use client'

import { useState, useEffect } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'

interface BrandPipelineCardProps {
  userId: string
  initialPendingCount?: number
  initialAcceptedCount?: number
  isSpotlightActive?: boolean
}

interface PipelineItem {
  label: string
  count?: number | string
  description: string
  isComingSoon: boolean
  customContent?: React.ReactNode
  badge?: React.ReactNode
}

export default function BrandPipelineCard({
  userId,
  initialPendingCount = 0,
  initialAcceptedCount = 0,
  isSpotlightActive = false,
}: BrandPipelineCardProps) {
  const supabase = useSupabaseClient()
  const [pendingCount, setPendingCount] = useState(initialPendingCount)
  const [acceptedCount, setAcceptedCount] = useState(initialAcceptedCount)

  // ... (keep useEffects same) ...
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

  const pipeline: PipelineItem[] = [
    {
      label: 'Keşif',
      description: '',
      isComingSoon: false,
      badge: (
        <div className="flex items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 backdrop-blur-sm">
          <span className="text-[9px] font-bold tracking-widest text-blue-400 leading-none">WITH AI</span>
        </div>
      ),
      customContent: (
        <div className="flex w-full h-full flex-col items-center justify-center pt-5">
          {isSpotlightActive ? (
            <>
              <div className="relative flex w-full max-w-[220px] items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm font-bold text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)] cursor-default">
                Spotlight Aktif
              </div>
              <p className="mt-3 text-sm text-center">
                <Link href="/dashboard/brand/discover" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                  Keşfetmek için tıklayın →
                </Link>
              </p>
            </>
          ) : (
            <>
              <Link
                href="/dashboard/spotlight/brand"
                className="relative flex w-full max-w-[220px] items-center justify-center rounded-xl border border-soft-gold/20 bg-soft-gold/5 px-4 py-3 text-sm font-bold text-soft-gold shadow-[0_0_15px_rgba(212,175,55,0.15)] transition-all hover:bg-soft-gold/10 hover:shadow-[0_0_20px_rgba(212,175,55,0.25)] hover:scale-[1.02]"
              >
                Spotlight'a Yükseltin
              </Link>
              <p className="mt-3 text-sm">
                AI eşleşmesi için
              </p>
            </>
          )}
        </div>
      )
    },
    { label: 'Teklif Gönderildi', count: pendingCount, description: 'Onay bekleyen iş birlikleri', isComingSoon: false },
    { label: 'Üretim', count: acceptedCount, description: 'İçerik üretimi devam ediyor', isComingSoon: false },
  ]

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:col-span-2 shadow-glow">
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
            className={`relative flex flex-col justify-between rounded-2xl border p-4 ${item.isComingSoon
              ? 'border-white/5 bg-[#0A0B0F] text-gray-400 opacity-60'
              : 'border-white/5 bg-[#11121A] text-gray-300'
              }`}
          >
            {item.badge && (
              <div className="absolute top-3 right-3">
                {item.badge}
              </div>
            )}

            <div>
              <p
                className={`text-xs uppercase tracking-[0.3em] ${item.isComingSoon ? 'text-gray-500' : 'text-soft-gold'
                  }`}
              >
                {item.label}
              </p>

              {item.customContent ? (
                item.customContent
              ) : (
                <p
                  className={`mt-3 text-3xl font-semibold ${item.isComingSoon ? 'text-gray-500' : 'text-white'
                    }`}
                >
                  {item.count}
                </p>
              )}
            </div>

            <p className={`mt-3 text-sm ${item.isComingSoon ? 'text-gray-500' : ''}`}>
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
