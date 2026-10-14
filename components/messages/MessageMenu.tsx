'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Ban, Flag, MoreHorizontal } from 'lucide-react'
import { reportMessage, type ReportMessagePayload } from '@/app/dashboard/messages/report/actions'
import { blockUser } from '@/app/dashboard/users/block/actions'
import { Button, ConfirmDialog, Field, Modal, Select, Textarea } from '@/components/ui'

interface Props {
  messageId: string
  senderId: string
  roomId: string
  onBlocked: () => void
}

const REASONS: Array<{ value: ReportMessagePayload['reason']; label: string }> = [
  { value: 'harassment', label: 'Taciz / rahatsız edici' },
  { value: 'spam', label: 'Spam' },
  { value: 'inappropriate', label: 'Uygunsuz içerik' },
  { value: 'illegal', label: 'Yasadışı içerik' },
  { value: 'other', label: 'Diğer' },
]

/** Gelen mesajın menüsü: rapor et, kullanıcıyı engelle. */
export default function MessageMenu({ messageId, senderId, roomId, onBlocked }: Props) {
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState<'report' | 'block' | null>(null)
  const [reason, setReason] = useState<ReportMessagePayload['reason']>('harassment')
  const [description, setDescription] = useState('')
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const report = () =>
    startTransition(async () => {
      const result = await reportMessage({ messageId, reportedUserId: senderId, roomId, reason, description: description || undefined })
      if (!result.success) {
        toast.error(result.error || 'Rapor gönderilemedi.')
        return
      }
      toast.success('Mesaj rapor edildi. İnceleme için teşekkürler.')
      setDialog(null)
      setDescription('')
      setReason('harassment')
    })

  const block = () =>
    startTransition(async () => {
      const result = await blockUser(senderId)
      if (!result.success) {
        toast.error(result.error || 'Kullanıcı engellenemedi.')
        return
      }
      toast.success('Kullanıcı engellendi.')
      setDialog(null)
      onBlocked()
    })

  return (
    <div ref={ref} className="relative">
      <Button size="sm" variant="ghost" iconOnly aria-label="Mesaj işlemleri" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="h-7 w-7">
        <MoreHorizontal />
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-line-strong bg-surface-2 py-1 shadow-modal">
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false)
              setDialog('report')
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink hover:bg-surface-3"
          >
            <Flag className="h-3.5 w-3.5 text-ink-muted" />
            Mesajı rapor et
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false)
              setDialog('block')
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-danger hover:bg-surface-3"
          >
            <Ban className="h-3.5 w-3.5" />
            Kullanıcıyı engelle
          </button>
        </div>
      )}

      <Modal
        open={dialog === 'report'}
        onClose={() => setDialog(null)}
        dismissible={!isPending}
        size="sm"
        title="Mesajı rapor et"
        description="Raporun moderatörler tarafından incelenir."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDialog(null)} disabled={isPending}>
              Vazgeç
            </Button>
            <Button variant="danger" size="sm" loading={isPending} onClick={report}>
              Rapor et
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label="Neden">
            {(p) => (
              <Select {...p} value={reason} onChange={(e) => setReason(e.target.value as ReportMessagePayload['reason'])}>
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Açıklama" hint="İsteğe bağlı">
            {(p) => <Textarea {...p} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={dialog === 'block'}
        onClose={() => setDialog(null)}
        onConfirm={block}
        loading={isPending}
        tone="danger"
        title="Kullanıcı engellensin mi?"
        description="Engellediğin kullanıcı sana mesaj gönderemez. Engeli profil penceresinden kaldırabilirsin."
        confirmLabel="Engelle"
      />
    </div>
  )
}
