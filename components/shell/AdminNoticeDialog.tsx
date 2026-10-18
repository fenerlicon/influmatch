'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import type { AdminNotice } from '@/lib/admin-notices-shared'
import { markNotificationAsRead } from '@/app/actions/notifications'
import { Button, Modal } from '@/components/ui'

const formatDate = (value: string) =>
  new Date(value).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

/**
 * Admin duyurusu penceresi (lib/admin-notices-shared.ts): panele girişte okunmamış duyurular sırayla gösterilir;
 * "Anladım" duyuruyu okundu işaretler, bir daha açılmaz.
 */
export default function AdminNoticeDialog({ notices }: { notices: AdminNotice[] }) {
  const router = useRouter()
  const [queue, setQueue] = useState(notices)
  const [isPending, startTransition] = useTransition()
  const current = queue[0]
  if (!current) return null

  const acknowledge = () =>
    startTransition(async () => {
      await markNotificationAsRead(current.id).catch(() => null)
      const rest = queue.slice(1)
      setQueue(rest)
      if (rest.length === 0) router.refresh()
    })

  return (
    <Modal
      open
      onClose={acknowledge}
      dismissible={!isPending}
      size="sm"
      title={
        <span className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-warning/15 text-warning">
            <ShieldAlert className="h-[18px] w-[18px]" aria-hidden />
          </span>
          {current.title}
        </span>
      }
      description={formatDate(current.created_at)}
      footer={
        <Button variant="primary" size="sm" onClick={acknowledge} loading={isPending}>
          {queue.length > 1 ? `Anladım (${queue.length - 1} duyuru daha)` : 'Anladım'}
        </Button>
      }
    >
      <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink">{current.message}</p>
      <p className="mt-3 text-[12.5px] text-ink-muted">Bir yanlışlık olduğunu düşünüyorsan Ayarlar → Destek&apos;ten bize yazabilirsin.</p>
    </Modal>
  )
}
