'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { FileText, MessageSquare } from 'lucide-react'
import { cancelApplication } from '@/app/dashboard/influencer/advert/actions'
import { Avatar, Button, ButtonLink, Card, Chip, ConfirmDialog, EmptyState, ListRow, VerifiedTick } from '@/components/ui'
import { worksHref } from '@/lib/works'
import { APPLICATION_STATUS, formatExpectation, relativeDay, type AdvertApplication } from '@/lib/adverts-shared'

/** Influencer'ın başvuruları: durum, mesaj, bekleyen başvuruyu geri çekme. */
export default function MyApplications({ applications, onBrowse }: { applications: AdvertApplication[]; onBrowse: () => void }) {
  const router = useRouter()
  const [items, setItems] = useState(applications)
  const [withdrawing, setWithdrawing] = useState<AdvertApplication | null>(null)
  const [isPending, startTransition] = useTransition()

  const withdraw = () => {
    if (!withdrawing) return
    const target = withdrawing
    startTransition(async () => {
      const result = await cancelApplication(target.id)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      setItems((prev) => prev.filter((a) => a.id !== target.id))
      setWithdrawing(null)
      toast.success('Başvurun geri çekildi.')
      router.refresh()
    })
  }

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={FileText}
          title="Henüz başvurun yok"
          description="Açık ilanlardan sana uygun olanlara başvurduğunda durumları burada görünür."
          action={
            <Button size="sm" variant="primary" onClick={onBrowse}>
              Açık ilanlara bak
            </Button>
          }
        />
      </Card>
    )
  }

  return (
    <>
      <Card className="mt-4 overflow-hidden">
        {items.map((a) => {
          const brandName = a.brand?.full_name || (a.brand?.username ? `@${a.brand.username}` : 'Marka')
          const status = APPLICATION_STATUS[a.status] ?? APPLICATION_STATUS.pending
          const expectation = formatExpectation(a.budget_expectation)
          return (
            <ListRow key={a.id} className="items-start py-4">
              <Avatar name={brandName} src={a.brand?.avatar_url} square />
              <div className="min-w-0 flex-[1_1_220px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-medium text-ink">{a.advert_title}</span>
                  <Chip tone={status.tone} dot>
                    {status.label}
                  </Chip>
                </div>
                <div className="flex flex-wrap items-center gap-x-1 text-xs text-ink-faint">
                  {a.brand?.username ? (
                    <Link href={`/profile/${a.brand.username}`} className="hover:text-ink">
                      {brandName}
                    </Link>
                  ) : (
                    <span>{brandName}</span>
                  )}
                  {a.brand?.verification_status === 'verified' && <VerifiedTick tone="gold" />}
                  <span>· {relativeDay(a.created_at)}</span>
                  {expectation && <span>· Beklenti {expectation}</span>}
                </div>
                {a.status === 'accepted' && <div className="mt-1 text-[12.5px] text-ink-muted">İş başladı; ayrıntılar İşler sayfasında.</div>}
              </div>
              <div className="ml-auto flex flex-wrap gap-1.5">
                {a.status === 'pending' && (
                  <Button size="sm" variant="ghost" onClick={() => setWithdrawing(a)}>
                    Geri çek
                  </Button>
                )}
                {a.room_id && (
                  <ButtonLink size="sm" href={`/dashboard/messages?roomId=${a.room_id}`} leftIcon={<MessageSquare />}>
                    Mesaj
                  </ButtonLink>
                )}
                {a.status === 'accepted' && (
                  <ButtonLink size="sm" variant="primary" href={worksHref('active')}>
                    İşe git
                  </ButtonLink>
                )}
              </div>
            </ListRow>
          )
        })}
      </Card>

      <ConfirmDialog
        open={!!withdrawing}
        onClose={() => setWithdrawing(null)}
        onConfirm={withdraw}
        loading={isPending}
        tone="danger"
        title="Başvuru geri çekilsin mi?"
        description={withdrawing ? `"${withdrawing.advert_title}" başvurun silinir. İlan hâlâ açıksa yeniden başvurabilirsin.` : undefined}
        confirmLabel="Geri çek"
      />
    </>
  )
}
