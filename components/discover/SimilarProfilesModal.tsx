'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { getSimilarInfluencers } from '@/app/actions/spotlight'
import type { DiscoverInfluencer } from '@/types/influencer'
import { Avatar, EmptyState, Modal } from '@/components/ui'

interface Props {
  open: boolean
  onClose: () => void
  baseInfluencerId: string
  baseInfluencerName: string
}

/** Benzer profiller (Spotlight). */
export default function SimilarProfilesModal({ open, onClose, baseInfluencerId, baseInfluencerName }: Props) {
  const [profiles, setProfiles] = useState<DiscoverInfluencer[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setProfiles(null)
    setError(null)
    getSimilarInfluencers(baseInfluencerId)
      .then((result) => (result.error ? setError(result.error) : setProfiles(result.data)))
      .catch(() => setError('Benzer profiller yüklenemedi.'))
  }, [open, baseInfluencerId])

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Benzer profiller" description={`${baseInfluencerName} profiline benzeyenler`}>
      {error ? (
        <p className="py-6 text-center text-sm text-danger">{error}</p>
      ) : profiles === null ? (
        <p className="py-6 text-center text-[13px] text-ink-faint">Yükleniyor…</p>
      ) : profiles.length === 0 ? (
        <EmptyState icon={Users} title="Benzer profil bulunamadı" />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {profiles.map((p) => (
            <Link
              key={p.id}
              href={`/profile/${p.username || p.id}`}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3 transition-colors hover:border-line-strong"
            >
              <Avatar name={p.full_name || p.username} src={p.avatar_url} />
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-medium text-ink">{p.full_name || p.username}</div>
                <div className="truncate text-xs text-ink-faint">
                  {p.username ? `@${p.username}` : ''}
                  {p.stats?.followers ? ` · ${p.stats.followers} takipçi` : ''}
                  {p.stats?.engagement ? ` · ${p.stats.engagement}` : ''}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Modal>
  )
}
