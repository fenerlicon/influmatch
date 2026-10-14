'use client'

import { useEffect, useState, useTransition } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { toast } from 'sonner'
import { ExternalLink } from 'lucide-react'
import { blockUser, unblockUser } from '@/app/dashboard/users/block/actions'
import { getCategoryLabel } from '@/utils/categories'
import { Avatar, Button, ButtonLink, Chip, ConfirmDialog, Eyebrow, Modal, VerifiedTick } from '@/components/ui'
import { participantTick, type Participant } from './types'

interface Props {
  open: boolean
  onClose: () => void
  participant: Participant
  currentUserId: string
  /** Engel değişince sohbet penceresi yeniden kontrol eder. */
  onBlockChange: () => void
}

interface ProfileData {
  bio: string | null
  city: string | null
  category: string | null
  socialLinks: Record<string, string | null>
  isBlocked: boolean
}

const ROLE_LABEL = { admin: 'Yönetici', brand: 'Marka', influencer: 'Influencer' } as const

/** Sohbetteki karşı tarafın kısa profili; engelle / engeli kaldır burada. */
export default function ProfileSheet({ open, onClose, participant, currentUserId, onBlockChange }: Props) {
  const supabase = useSupabaseClient()
  const [data, setData] = useState<ProfileData | null>(null)
  const [failed, setFailed] = useState(false)
  const [confirmBlock, setConfirmBlock] = useState(false)
  const [isPending, startTransition] = useTransition()
  const tick = participantTick(participant)

  useEffect(() => {
    if (!open) return
    setData(null)
    setFailed(false)
    Promise.all([
      supabase.from('users').select('bio, city, category, social_links').eq('id', participant.id).maybeSingle(),
      supabase.from('user_blocks').select('id').eq('blocker_user_id', currentUserId).eq('blocked_user_id', participant.id).maybeSingle(),
    ])
      .then(([profile, block]) => {
        if (profile.error) throw profile.error
        setData({
          bio: profile.data?.bio ?? null,
          city: profile.data?.city ?? null,
          category: profile.data?.category ?? null,
          socialLinks: (profile.data?.social_links as Record<string, string | null>) ?? {},
          isBlocked: !!block.data,
        })
      })
      .catch(() => setFailed(true))
  }, [open, participant.id, currentUserId, supabase])

  const setBlocked = (blocked: boolean) =>
    startTransition(async () => {
      const result = blocked ? await blockUser(participant.id) : await unblockUser(participant.id)
      if (!result.success) {
        toast.error(result.error || 'İşlem başarısız.')
        return
      }
      setData((d) => (d ? { ...d, isBlocked: blocked } : d))
      setConfirmBlock(false)
      toast.success(blocked ? 'Kullanıcı engellendi.' : 'Engel kaldırıldı.')
      onBlockChange()
    })

  const links = data ? Object.entries(data.socialLinks).filter(([, url]) => !!url) : []

  return (
    <>
      <Modal open={open} onClose={onClose} size="md" title="Profil">
        <div className="flex items-center gap-3.5">
          <Avatar name={participant.fullName} src={participant.avatarUrl} size="lg" square={participant.role === 'brand'} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[17px] font-semibold text-ink">
              <span className="truncate">{participant.fullName}</span>
              {tick && <VerifiedTick tone={tick.tone} label={tick.label} />}
            </div>
            {participant.username && <div className="text-xs text-ink-faint">@{participant.username}</div>}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {participant.role && <Chip>{ROLE_LABEL[participant.role]}</Chip>}
              {data?.category && <Chip>{getCategoryLabel(data.category)}</Chip>}
              {data?.city && <Chip>{data.city}</Chip>}
            </div>
          </div>
        </div>

        {failed ? (
          <p className="mt-4 text-[13px] text-danger">Profil bilgileri yüklenemedi.</p>
        ) : !data ? (
          <p className="mt-4 text-[13px] text-ink-faint">Yükleniyor…</p>
        ) : (
          <>
            {data.bio && <p className="mt-4 whitespace-pre-line text-[13.5px] text-ink-muted">{data.bio}</p>}
            {links.length > 0 && (
              <div className="mt-4">
                <Eyebrow>Sosyal medya</Eyebrow>
                <div className="mt-2 flex flex-wrap gap-2">
                  {links.map(([key, url]) => (
                    <a
                      key={key}
                      href={url!}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[12.5px] capitalize text-ink-muted hover:text-ink"
                    >
                      {key}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
              {participant.role === 'admin' ? (
                <span />
              ) : data.isBlocked ? (
                <Button size="sm" variant="ghost" loading={isPending} onClick={() => setBlocked(false)}>
                  Engeli kaldır
                </Button>
              ) : (
                <Button size="sm" variant="danger" onClick={() => setConfirmBlock(true)}>
                  Engelle
                </Button>
              )}
              {participant.username && participant.role !== 'admin' && (
                <ButtonLink size="sm" href={`/profile/${participant.username}`}>
                  Profili aç
                </ButtonLink>
              )}
            </div>
          </>
        )}
      </Modal>
      <ConfirmDialog
        open={confirmBlock}
        onClose={() => setConfirmBlock(false)}
        onConfirm={() => setBlocked(true)}
        loading={isPending}
        tone="danger"
        title="Kullanıcı engellensin mi?"
        description="Engellediğin kullanıcı sana mesaj gönderemez. Engeli buradan kaldırabilirsin."
        confirmLabel="Engelle"
      />
    </>
  )
}
