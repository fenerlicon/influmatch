'use client'

import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface OfferActivityItem {
  id: string
  campaign_name: string | null
  status: string
  budget: number | null
  created_at: string
  sender: {
    full_name: string | null
  } | null
}

interface OfferActivityCardProps {
  userId: string
  initialOffers: OfferActivityItem[]
  dismissedOfferIds?: Set<string>
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Cevap bekleniyor',
  accepted: 'Kabul edildi',
  rejected: 'Reddedildi',
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'text-gray-400',
  accepted: 'text-emerald-200',
  rejected: 'text-red-200',
}

const formatBudget = (value: number | null) => {
  if (value === null || value === undefined) return 'Belirlenmedi'
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function OfferActivityCard({ userId, initialOffers, dismissedOfferIds = new Set() }: OfferActivityCardProps) {
  const supabase = useSupabaseClient()
  const [offers, setOffers] = useState<OfferActivityItem[]>(initialOffers)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(dismissedOfferIds)

  const fetchOfferById = useCallback(
    async (offerId: string) => {
      const { data } = await supabase
        .from('offers')
        .select(`id, campaign_name, status, budget, created_at, sender:sender_user_id(full_name)`)
        .eq('id', offerId)
        .single()
      return data as OfferActivityItem | null
    },
    [supabase],
  )

  // Update offers when initialOffers prop changes
  useEffect(() => {
    const filtered = initialOffers.filter((o) => !dismissedIds.has(o.id))
    setOffers(filtered)
  }, [initialOffers, dismissedIds])

  // Real-time updates for offers
  useEffect(() => {
    const channel = supabase
      .channel(`offer-activity-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'offers', filter: `receiver_user_id=eq.${userId}` },
        async (payload) => {
          const fresh = await fetchOfferById(payload.new.id as string)
          if (fresh) {
            // Check if dismissed
            const { data: dismissed } = await supabase
              .from('dismissed_offers')
              .select('id')
              .eq('user_id', userId)
              .eq('offer_id', fresh.id)
              .maybeSingle()

            if (!dismissed) {
              setOffers((prev) => {
                const filtered = prev.filter((offer) => offer.id !== fresh.id)
                const updated = [fresh, ...filtered]
                return updated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5)
              })
            } else {
              setDismissedIds((prev) => {
                const next = new Set(prev)
                next.add(fresh.id)
                return next
              })
            }
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'offers', filter: `receiver_user_id=eq.${userId}` },
        async (payload) => {
          const fresh = await fetchOfferById(payload.new.id as string)
          if (fresh) {
            // Check if dismissed
            const { data: dismissed } = await supabase
              .from('dismissed_offers')
              .select('id')
              .eq('user_id', userId)
              .eq('offer_id', fresh.id)
              .maybeSingle()

            if (dismissed) {
              setDismissedIds((prev) => {
                const next = new Set(prev)
                next.add(fresh.id)
                return next
              })
              setOffers((prev) => prev.filter((offer) => offer.id !== fresh.id))
            } else {
              setDismissedIds((prev) => {
                if (prev.has(fresh.id)) {
                  const next = new Set(prev)
                  next.delete(fresh.id)
                  return next
                }
                return prev
              })
              setOffers((prev) => {
                const exists = prev.some((offer) => offer.id === fresh.id)
                if (exists) {
                  const updated = prev.map((offer) => (offer.id === fresh.id ? fresh : offer))
                  return updated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5)
                } else {
                  const newList = [fresh, ...prev]
                  return newList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5)
                }
              })
            }
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'offers', filter: `receiver_user_id=eq.${userId}` },
        (payload) => {
          setOffers((prev) => prev.filter((offer) => offer.id !== (payload.old.id as string)))
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dismissed_offers', filter: `user_id=eq.${userId}` },
        (payload) => {
          const offerId = payload.new.offer_id as string | null
          if (offerId) {
            setDismissedIds((prev) => {
              const next = new Set(prev)
              next.add(offerId)
              return next
            })
            setOffers((prev) => prev.filter((offer) => offer.id !== offerId))
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'dismissed_offers', filter: `user_id=eq.${userId}` },
        (payload) => {
          const offerId = payload.old.offer_id as string | null
          if (offerId) {
            setDismissedIds((prev) => {
              const next = new Set(prev)
              next.delete(offerId)
              return next
            })
            // Optionally re-fetch the offer if it was undismissed
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchOfferById, supabase, userId])

  const items = useMemo(() => {
    return offers
      .filter((offer) => !dismissedIds.has(offer.id))
      .map((offer) => ({
        id: offer.id,
        title: offer.campaign_name ?? 'İsimsiz kampanya',
        brand: offer.sender?.full_name ?? 'Marka',
        status: STATUS_LABELS[offer.status] ?? offer.status,
        statusStyle: STATUS_STYLES[offer.status] ?? 'text-gray-400',
        budget: formatBudget(offer.budget),
      }))
  }, [dismissedIds, offers])


  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Teklif Akışı</p>
      <h3 className="mt-2 text-xl font-semibold text-white">Son güncellemeler</h3>

      {items.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-white/10 bg-[#11121A] p-6 text-sm text-gray-400">
          Henüz teklif yok. Spotlight vitrinini aktif tutarak markalardan daha hızlı dönüş alabilirsin.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {items.map((offer) => (
            <div key={offer.id} className="rounded-2xl border border-white/5 bg-[#11121A] p-4">
              <p className="text-sm font-semibold text-white">{offer.title}</p>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{offer.brand}</p>
              <p className={`mt-2 text-xs uppercase tracking-[0.3em] ${offer.statusStyle}`}>{offer.status}</p>
              <p className="mt-2 text-sm text-soft-gold">{offer.budget}</p>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/dashboard/offers"
        className="mt-4 block w-full rounded-2xl border border-white/10 px-4 py-3 text-center text-sm font-semibold text-white transition hover:border-soft-gold/50 hover:text-soft-gold"
      >
        Tüm teklifleri gör
      </Link>
    </div>
  )
}
